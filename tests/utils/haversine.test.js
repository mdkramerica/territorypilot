const { haversine, nearestNeighborTSP } = require('../../src/utils/haversine');

describe('haversine', () => {
  test('returns 0 for same coordinates', () => {
    expect(haversine(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  test('calculates distance between NYC and LA approximately', () => {
    const dist = haversine(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(2400);
    expect(dist).toBeLessThan(2500);
  });

  test('calculates distance between London and Paris approximately', () => {
    const dist = haversine(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(230);
  });

  test('handles equator crossing', () => {
    const dist = haversine(1, 0, -1, 0);
    expect(dist).toBeGreaterThan(130);
    expect(dist).toBeLessThan(140);
  });
});

describe('nearestNeighborTSP', () => {
  test('returns empty route for empty input', () => {
    const { route, totalMiles } = nearestNeighborTSP([], 0, 0);
    expect(route).toEqual([]);
    expect(totalMiles).toBe(0);
  });

  test('returns single stop for one account', () => {
    const accounts = [{ id: '1', name: 'A', lat: 40.7128, lng: -74.006 }];
    const { route } = nearestNeighborTSP(accounts, 40.7128, -74.006);
    expect(route).toHaveLength(1);
    expect(route[0].id).toBe('1');
  });

  test('orders stops by nearest neighbor', () => {
    const accounts = [
      { id: 'far', name: 'Far', lat: 41.0, lng: -74.0 },
      { id: 'near', name: 'Near', lat: 40.72, lng: -74.01 },
      { id: 'mid', name: 'Mid', lat: 40.8, lng: -74.0 },
    ];
    const { route } = nearestNeighborTSP(accounts, 40.71, -74.0);

    // Nearest to start should be first
    expect(route[0].id).toBe('near');
    expect(route).toHaveLength(3);
  });

  test('skips accounts without lat/lng', () => {
    const accounts = [
      { id: '1', name: 'A', lat: 40.7128, lng: -74.006 },
      { id: '2', name: 'B', lat: null, lng: null },
      { id: '3', name: 'C', lat: 40.73, lng: -74.0 },
    ];
    const { route } = nearestNeighborTSP(accounts, 40.71, -74.0);
    expect(route).toHaveLength(2);
    expect(route.find((r) => r.id === '2')).toBeUndefined();
  });

  test('calculates total miles', () => {
    const accounts = [
      { id: '1', name: 'A', lat: 40.7128, lng: -74.006 },
      { id: '2', name: 'B', lat: 40.73, lng: -74.0 },
    ];
    const { totalMiles } = nearestNeighborTSP(accounts, 40.71, -74.0);
    expect(totalMiles).toBeGreaterThan(0);
  });
});
