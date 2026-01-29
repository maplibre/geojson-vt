import {test, expect} from 'vitest';
import {applySourceDiff} from './difference';

const options = {
    maxZoom: 14,
    indexMaxZoom: 5,
    indexMaxPoints: 100000,
    tolerance: 3,
    extent: 4096,
    buffer: 64,
    updateable: true
};

test('applySourceDiff: adds a feature using the feature id', () => {
    const point = {
        type: 'Feature' as const,
        id: 'point',
        geometry: {
            type: 'Point' as const,
            coordinates: [0, 0]
        },
        properties: {},
    };

    const {source} = applySourceDiff([], {
        add: [point]
    }, options);

    expect(source.length).toBe(1);
    expect(source[0].id).toBe('point');
});

test('applySourceDiff: adds a feature using the promoteId', () => {
    const point2 = {
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [0, 0],
        },
        properties: {
            promoteId: 'point2'
        },
    };

    const {source} = applySourceDiff([], {
        add: [point2]
    }, {promoteId: 'promoteId'});

    expect(source.length).toBe(1);
    expect(source[0].id).toBe('point2');
});

test('applySourceDiff: removes a feature by its id', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const point2 = {
        type: 'Point' as const,
        id: 'point2',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point, point2], {
        remove: ['point2'],
    }, options);

    expect(source.length).toBe(1);
    expect(source[0].id).toBe('point');
});

test('applySourceDiff: removeAll clears all features', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const point2 = {
        type: 'Point' as const,
        id: 'point2',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const source = [point, point2];
    const result = applySourceDiff(source, {
        removeAll: true
    }, options);

    expect(source).toEqual(result.affected);
    expect(result.source).toEqual([]);
});

test('applySourceDiff: updates a feature geometry', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{
            id: 'point',
            newGeometry: {
                type: 'Point',
                coordinates: [1, 0]
            }
        }]
    }, options);

    expect(source.length).toBe(1);
    expect(source[0].id).toBe('point');
    expect(source[0].geometry[0]).toBe(0.5027777777777778);
    expect(source[0].geometry[1]).toBe(0.5);
});

test('applySourceDiff: adds properties', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{
            id: 'point',
            addOrUpdateProperties: [
                {key: 'prop', value: 'value'},
                {key: 'prop2', value: 'value2'}
            ]
        }]
    }, options);

    expect(source.length).toBe(1);
    const tags = source[0].tags;
    expect(Object.keys(tags).length).toBe(2);
    expect(tags.prop).toBe('value');
    expect(tags.prop2).toBe('value2');
});

test('applySourceDiff: updates properties', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {prop: 'value', prop2: 'value2'},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{
            id: 'point',
            addOrUpdateProperties: [
                {key: 'prop2', value: 'value3'}
            ]
        }]
    }, options);
    expect(source.length).toBe(1);

    const tags2 = source[0].tags;
    expect(Object.keys(tags2).length).toBe(2);
    expect(tags2.prop).toBe('value');
    expect(tags2.prop2).toBe('value3');
});

test('applySourceDiff: removes properties', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {prop: 'value', prop2: 'value2'},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{
            id: 'point',
            removeProperties: ['prop2']
        }]
    }, options);

    expect(source.length).toBe(1);
    const tags3 = source[0].tags;
    expect(Object.keys(tags3).length).toBe(1);
    expect(tags3.prop).toBe('value');
});

test('applySourceDiff: removes all properties', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {prop: 'value', prop2: 'value2'},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{
            id: 'point',
            removeAllProperties: true,
        }]
    }, options);

    expect(source.length).toBe(1);
    expect(Object.keys(source[0].tags).length).toBe(0);
});

test('applySourceDiff: empty update preserves properties', () => {
    const point = {
        type: 'Point' as const,
        id: 'point',
        geometry: [0, 0],
        tags: {prop: 'value', prop2: 'value2'},
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
    };

    const {source} = applySourceDiff([point], {
        update: [{id: 'point'}]
    }, options);

    expect(source.length).toBe(1);
    const tags2 = source[0].tags;
    expect(Object.keys(tags2).length).toBe(2);
    expect(tags2.prop).toBe('value');
    expect(tags2.prop2).toBe('value2');
});
