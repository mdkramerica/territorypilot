/**
 * Geocode service tests (mocked HTTP)
 */
jest.mock('axios');
const axios = require('axios');
const { geocodeAddress, geocodeBatch } = require('../../src/services/geocode');

// Mock config to have an API key
jest.mock('../../src/config', () => ({
  config: {
    google: { mapsApiKey: 'test-key' },
  },
}));

describe('geocodeAddress', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns null for empty address', async () => {
    const result = await geocodeAddress('');
    expect(result).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('returns null for null address', async () => {
    const result = await geocodeAddress(null);
    expect(result).toBeNull();
  });

  test('returns coordinates for valid response', async () => {
    axios.get.mockResolvedValue({
      data: {
        results: [{ geometry: { location: { lat: 40.7128, lng: -74.006 } } }],
      },
    });

    const result = await geocodeAddress('New York, NY');
    expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('returns null when no results', async () => {
    axios.get.mockResolvedValue({ data: { results: [] } });
    const result = await geocodeAddress('nonexistent place');
    expect(result).toBeNull();
  });

  test('returns null on network error', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));
    const result = await geocodeAddress('123 Main St');
    expect(result).toBeNull();
  });
});

describe('geocodeBatch', () => {
  afterEach(() => jest.clearAllMocks());

  test('geocodes batch of items', async () => {
    axios.get.mockResolvedValue({
      data: {
        results: [{ geometry: { location: { lat: 1, lng: 2 } } }],
      },
    });

    const items = [
      { name: 'A', address: '123 Main St' },
      { name: 'B', address: '456 Oak Ave' },
    ];

    const results = await geocodeBatch(items, (i) => i.address);
    expect(results).toHaveLength(2);
    expect(results[0].lat).toBe(1);
    expect(results[0].lng).toBe(2);
    expect(results[0].name).toBe('A');
  });

  test('handles items without addresses', async () => {
    const items = [{ name: 'A', address: '' }];
    const results = await geocodeBatch(items, (i) => i.address);
    expect(results[0].lat).toBeNull();
    expect(results[0].lng).toBeNull();
  });
});
