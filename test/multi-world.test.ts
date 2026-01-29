
import {test, expect} from 'vitest';
import geojsonvt from '../src';

const leftPoint = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
        coordinates: [-540, 0],
        type: 'Point' as const
    }
};

const rightPoint = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
        coordinates: [540, 0],
        type: 'Point' as const
    }
};

test('handle point only in the rightside world', () => {
    const vt = geojsonvt(rightPoint);
    expect(vt.tiles[0].features[0].geometry[0]).toBe(1);
    expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);
});

test('handle point only in the leftside world', () => {
    const vt = geojsonvt(leftPoint);
    expect(vt.tiles[0].features[0].geometry[0]).toBe(0);
    expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);
});

test('handle points in the leftside world and the rightside world', () => {
    const vt = geojsonvt({
        type: 'FeatureCollection',
        features: [leftPoint, rightPoint]
    });

    expect(vt.tiles[0].features[0].geometry[0]).toBe(0);
    expect(vt.tiles[0].features[0].geometry[1]).toBe(.5);

    expect(vt.tiles[0].features[1].geometry[0]).toBe(1);
    expect(vt.tiles[0].features[1].geometry[1]).toBe(.5);
});
