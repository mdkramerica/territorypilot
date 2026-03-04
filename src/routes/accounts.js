/**
 * Account CRUD routes + CSV import
 */
const { Router } = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const supabase = require('../services/supabase');
const { geocodeAddress, geocodeBatch } = require('../services/geocode');
const auth = require('../middleware/auth');
const { validate, createAccountSchema, updateAccountSchema } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

const MAX_IMPORT_ROWS = 500;

// GET /api/accounts
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('priority', { ascending: true })
      .order('last_visited', { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: 'Failed to load accounts' });
    res.json({ accounts: data, total: count, page, limit });
  })
);

// POST /api/accounts
router.post(
  '/',
  auth,
  validate(createAccountSchema),
  asyncHandler(async (req, res) => {
    const { name, address, contact_name, contact_email, contact_phone, notes, priority, visit_frequency_days } = req.body;

    const account = {
      user_id: req.user.id,
      name,
      address: address || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      notes: notes || null,
      priority,
      visit_frequency_days,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (address) {
      const coords = await geocodeAddress(address);
      if (coords) {
        account.lat = coords.lat;
        account.lng = coords.lng;
      }
    }

    const { data, error } = await supabase.from('accounts').insert(account).select().single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with this name already exists' });
      }
      return res.status(500).json({ error: 'Failed to create account' });
    }
    res.status(201).json(data);
  })
);

// PUT /api/accounts/:id
router.put(
  '/:id',
  auth,
  validate(updateAccountSchema),
  asyncHandler(async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    // Re-geocode if address changed
    if (updates.address) {
      const coords = await geocodeAddress(updates.address);
      if (coords) {
        updates.lat = coords.lat;
        updates.lng = coords.lng;
      }
    }

    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update account' });
    if (!data) return res.status(404).json({ error: 'Account not found' });
    res.json(data);
  })
);

// DELETE /api/accounts/:id
router.delete(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: 'Failed to delete account' });
    res.json({ deleted: true });
  })
);

// POST /api/accounts/:id/visit
router.post(
  '/:id/visit',
  auth,
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('accounts')
      .update({ last_visited: today, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to mark visit' });
    if (!data) return res.status(404).json({ error: 'Account not found' });
    res.json(data);
  })
);

// GET /api/accounts/:id/logs
router.get(
  '/:id/logs',
  auth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('call_logs')
      .select('id, summary, outcome, transcript, created_at')
      .eq('account_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: 'Failed to load logs' });
    res.json(data);
  })
);

// POST /api/accounts/geocode — re-geocode accounts missing lat/lng
router.post(
  '/geocode',
  auth,
  asyncHandler(async (req, res) => {
    const { data: ungeocodedAccounts, error } = await supabase
      .from('accounts')
      .select('id, address')
      .eq('user_id', req.user.id)
      .not('address', 'is', null)
      .is('lat', null);

    if (error) return res.status(500).json({ error: 'Failed to load accounts' });
    if (!ungeocodedAccounts?.length) {
      return res.json({ geocoded: 0, message: 'All accounts with addresses are already geocoded' });
    }

    let geocoded = 0;
    for (const account of ungeocodedAccounts) {
      if (!account.address) continue;
      const coords = await geocodeAddress(account.address);
      if (coords) {
        await supabase
          .from('accounts')
          .update({ lat: coords.lat, lng: coords.lng, updated_at: new Date().toISOString() })
          .eq('id', account.id)
          .eq('user_id', req.user.id);
        geocoded++;
      }
    }

    res.json({ geocoded, total: ungeocodedAccounts.length });
  })
);

// POST /api/accounts/import
router.post(
  '/import',
  auth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV file required' });

    const accounts = [];
    const stream = Readable.from(req.file.buffer.toString('utf-8'));

    await new Promise((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (row) => {
          if (accounts.length < MAX_IMPORT_ROWS) {
            accounts.push({
              name: (row.name || row.Name || '').slice(0, 255),
              address: (row.address || row.Address || '').slice(0, 500),
              contact_name: (row.contact_name || row['Contact Name'] || '').slice(0, 255),
              contact_email: (row.contact_email || row['Contact Email'] || '').slice(0, 255),
              contact_phone: (row.contact_phone || row['Contact Phone'] || '').slice(0, 50),
              notes: (row.notes || row.Notes || '').slice(0, 2000),
              priority: Math.min(3, Math.max(1, parseInt(row.priority || row.Priority, 10) || 2)),
              visit_frequency_days: Math.min(365, Math.max(1, parseInt(row.visit_frequency_days || '30', 10))),
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (!accounts.length) {
      return res.status(400).json({ error: 'No valid rows found in CSV' });
    }

    // Filter out rows without a name
    const validAccounts = accounts.filter((a) => a.name.trim());

    // Geocode in batches with concurrency limit
    const geocoded = await geocodeBatch(validAccounts, (a) => a.address);

    // Add user_id and timestamps
    const toInsert = geocoded.map((a) => ({
      ...a,
      user_id: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('accounts')
      .upsert(toInsert, { onConflict: 'user_id,name' });

    if (error) return res.status(500).json({ error: 'Failed to import accounts' });

    res.json({ imported: toInsert.length });
  })
);

module.exports = router;
