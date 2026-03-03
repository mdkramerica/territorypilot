/**
 * Stripe checkout + webhook routes
 */
const { Router } = require('express');
const Stripe = require('stripe');
const supabase = require('../services/supabase');
const auth = require('../middleware/auth');
const { validate, checkoutSchema } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { config } = require('../config');

const router = Router();

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;

// POST /api/stripe/checkout
router.post(
  '/checkout',
  auth,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Payment service unavailable' });

    const { plan } = req.body;
    const priceId = config.stripe.prices[plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: req.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: req.user.id, plan },
      success_url: `${config.appUrl}/dashboard.html?upgraded=true`,
      cancel_url: `${config.appUrl}/dashboard.html`,
      subscription_data: {
        trial_period_days: 14,
      },
    });

    res.json({ url: session.url });
  })
);

// POST /api/stripe/webhook (public, verified by signature)
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Payment service unavailable' });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch {
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.userId && session.metadata?.plan) {
          await supabase
            .from('users')
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              plan: session.metadata.plan,
              plan_active: true,
            })
            .eq('id', session.metadata.userId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        if (sub.id) {
          await supabase
            .from('users')
            .update({ plan_active: false })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }
    }

    res.json({ received: true });
  })
);

module.exports = router;
