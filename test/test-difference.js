import test from 'node:test';
import assert from 'node:assert/strict';
import {applySourceDiff, mergeSourceDiffs} from '../src/difference.js';

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
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
    };

    const {source} = applySourceDiff([], {
        add: [point]
    }, options);
    assert.equal(source.length, 1);
    assert.equal(source[0].id, 'point');
});

test('applySourceDiff: adds a feature using the promoteId', () => {
    const point2 = {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [0, 0],
        },
        properties: {
            promoteId: 'point2'
        },
    };

    const {source} = applySourceDiff([], {
        add: [point2]
    }, {promoteId: 'promoteId'});
    assert.equal(source.length, 1);
    assert.equal(source[0].id, 'point2');
});

test('applySourceDiff: removes a feature by its id', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
    };

    const point2 = {
        type: 'Feature',
        id: 'point2',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
    };

    const {source} = applySourceDiff([point, point2], {
        remove: ['point2'],
    }, options);
    assert.equal(source.length, 1);
    assert.equal(source[0].id, 'point');
});

test('applySourceDiff: updates a feature geometry', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
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

    assert.equal(source.length, 1);
    assert.equal(source[0].id, 'point');
    assert.equal(source[0].geometry[0], projectX(1));
    assert.equal(source[0].geometry[1], projectY(0));
});

test('applySourceDiff: adds properties', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {},
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
    assert.equal(source.length, 1);
    const tags = source[0].tags;
    assert.equal(Object.keys(tags).length, 2);
    assert.equal(tags.prop, 'value');
    assert.equal(tags.prop2, 'value2');
});

test('applySourceDiff: updates properties', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {prop: 'value', prop2: 'value2'},
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
    assert.equal(source.length, 1);
    const tags2 = source[0].tags;
    assert.equal(Object.keys(tags2).length, 2);
    assert.equal(tags2.prop, 'value');
    assert.equal(tags2.prop2, 'value3');
});

test('applySourceDiff: removes properties', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {prop: 'value', prop2: 'value2'},
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
    assert.equal(source.length, 1);
    const tags3 = source[0].tags;
    assert.equal(Object.keys(tags3).length, 1);
    assert.equal(tags3.prop, 'value');
});

test('applySourceDiff: removes all properties', () => {
    const point = {
        type: 'Feature',
        id: 'point',
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        },
        properties: {prop: 'value', prop2: 'value2'},
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
    assert.equal(source.length, 1);
    assert.equal(Object.keys(source[0].tags).length, 0);
});

test('mergeSourceDiffs: merges two diffs with different features ids', () => {
    const diff1 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
        remove: ['feature2'],
        update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}}],
    };

    const diff2 = {
        add: [{type: 'Feature', id: 'feature4', geometry: {type: 'Point', coordinates: [2, 2]}, properties: {}}],
        remove: ['feature5'],
        update: [{id: 'feature6', addOrUpdateProperties: [{key: 'prop', value: 'value'}]}],
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.add.length, 2);
    assert.equal(merged.remove.length, 2);
    assert.equal(merged.update.length, 2);
});

test('mergeSourceDiffs: merges two diffs with equivalent feature ids', () => {
    const diff1 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {param: 1}}],
        remove: ['feature2'],
        update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
    };

    const diff2 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [2, 2]}, properties: {param: 2}}],
        remove: ['feature2', 'feature4'],
        update: [{id: 'feature3', addOrUpdateProperties: [{key: 'prop2', value: 'value'}], removeProperties: ['prop3'], removeAllProperties: true}],
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.add.length, 1);
    assert.deepEqual(merged.add[0].geometry, {type: 'Point', coordinates: [2, 2]});
    assert.deepEqual(merged.add[0].properties, {param: 2});
    assert.equal(merged.remove.length, 2);
    assert.equal(merged.update.length, 1);
    assert.ok(merged.update[0].newGeometry);
    assert.equal(merged.update[0].addOrUpdateProperties.length, 2);
    assert.equal(merged.update[0].removeProperties.length, 1);
    assert.ok(merged.update[0].removeAllProperties);
});

test('mergeSourceDiffs: merges two diffs add then removeAll', () => {
    const diff1 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
    };

    const diff2 = {
        removeAll: true,
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.add, undefined);
    assert.equal(merged.removeAll, true);
});

test('mergeSourceDiffs: merges two diffs removeAll then add', () => {
    const diff1 = {
        removeAll: true,
    };

    const diff2 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.add.length, 1);
    assert.equal(merged.removeAll, true);
});

test('mergeSourceDiffs: merges two diffs update feature then remove', () => {
    const diff1 = {
        update: [{id: 'feature1', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
    };

    const diff2 = {
        remove: ['feature1']
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.update, undefined);
    assert.equal(merged.remove.length, 1);
});

test('mergeSourceDiffs: merges two diffs add feature then remove', () => {
    const diff1 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
    };

    const diff2 = {
        remove: ['feature1']
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged.add, undefined);
    assert.equal(merged.remove.length, 1);  // retain feature removal in case they are re-adding a duplicate id
});

test('mergeSourceDiffs: merges two diffs remove feature then add', () => {
    const diff1 = {
        remove: ['feature1']
    };

    const diff2 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [1, 1]}, properties: {}}],
    };

    const diff3 = {
        remove: ['feature1']
    };

    const merged1 = mergeSourceDiffs(diff1, diff2);
    assert.equal(merged1.add.length, 1);
    assert.equal(merged1.remove, undefined);

    const merged2 = mergeSourceDiffs(merged1, diff3);
    assert.equal(merged2.add, undefined);
    assert.equal(merged2.remove.length, 1);  // retain feature removal in case they are re-adding a duplicate id
});

test('mergeSourceDiffs: merges diff with empty', () => {
    const diff1 = {};

    const diff2 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
        remove: ['feature2'],
        update: [{id: 'feature3', newGeometry: {type: 'Point', coordinates: [1, 1]}, addOrUpdateProperties: [{key: 'prop1', value: 'value'}]}],
    };

    const merged = mergeSourceDiffs(diff1, diff2);
    assert.deepEqual(merged, diff2);
});

test('mergeSourceDiffs: merges diff with undefined', () => {
    const diff1 = {
        add: [{type: 'Feature', id: 'feature1', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}],
    };

    const merged = mergeSourceDiffs(diff1, undefined);
    assert.deepEqual(merged, diff1);
});

test('mergeSourceDiffs: merges two undefined diffs', () => {
    const merged = mergeSourceDiffs(undefined, undefined);
    assert.deepEqual(merged, {});
});

function projectX(x) {
    return x / 360 + 0.5;
}

function projectY(y) {
    const sin = Math.sin(y * Math.PI / 180);
    const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
    return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
