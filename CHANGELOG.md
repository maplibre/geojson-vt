## main
### ✨ Features and improvements
- _...Add new stuff here..._

### 🐞 Bug fixes
- _...Add new stuff here..._

- fix: hand the update filter features without coordinates with the id they are kept under ([#243](https://github.com/maplibre/geojson-vt/pull/243)) (by [@birkskyum](https://github.com/birkskyum))
- refactor: pass one worldCoordinateHelper instead of the worldCoordinates flag ([#242](https://github.com/maplibre/geojson-vt/pull/242)) (by [@birkskyum](https://github.com/birkskyum))
## 6.3.0
### ✨ Features and improvements
- Replace the experimental `worldCoordinates` option with two experimental options, `coordinates`, for positions in lng/lat or in the unit square, and `wrap`, for whether the world wraps around the antimeridian. `worldCoordinates: true` becomes `coordinates: 'unitSquare', wrap: false`, and `Supercluster` takes both in its options instead of its second constructor argument and its `worldCoordinates` field ([#241](https://github.com/maplibre/geojson-vt/pull/241)) (by [@birkskyum](https://github.com/birkskyum))

### 🐞 Bug fixes
- Fix `updateData` losing a feature with a null geometry or no coordinates, so that a later update could not give it any ([#240](https://github.com/maplibre/geojson-vt/pull/240)) (by [@johncarmack1984](https://github.com/johncarmack1984))

## 6.2.0

### ✨ Features and improvements

- Reduce memory usage of clustering ([#223](https://github.com/maplibre/geojson-vt/pull/223)) (by [@birkskyum](https://github.com/birkskyum))
- Add a `worldCoordinates` option for positions given as x and y from 0 to 1 in a world square of its own, which neither wraps around nor clamps ([#224](https://github.com/maplibre/geojson-vt/pull/224)) (by [@johncarmack1984](https://github.com/johncarmack1984))
- Increase the accuracy of clustering from ~1 m to ~4 cm, and reduce its memory usage, by storing cluster coordinates as integers. On dense data the clusters come out differently ([#230](https://github.com/maplibre/geojson-vt/pull/230)) (by [@birkskyum](https://github.com/birkskyum))

### 🐞 Bug fixes

- Fix `MultiPoint` features missing from a clustered index, by clustering each of their positions as a point of its own ([#231](https://github.com/maplibre/geojson-vt/pull/231)) (by [@birkskyum](https://github.com/birkskyum))
- Fix `updateData` changing the id of a feature when it updates its geometry, with `generateId` or when the promoted property changes too ([#233](https://github.com/maplibre/geojson-vt/pull/233)) (by [@birkskyum](https://github.com/birkskyum))
- Fix a polygon or line losing parts in a tile when one of its vertices lies exactly on a tile edge ([#226](https://github.com/maplibre/geojson-vt/pull/226)) (by [@birkskyum](https://github.com/birkskyum))
- Fix a `MultiPolygon` with an empty polygon throwing when the index is built ([#227](https://github.com/maplibre/geojson-vt/pull/227)) (by [@birkskyum](https://github.com/birkskyum))
- Fix `updateData` throwing when it adds a feature without properties while `promoteId` is set ([#228](https://github.com/maplibre/geojson-vt/pull/228)) (by [@birkskyum](https://github.com/birkskyum))
- Stop the cluster index from keeping the cluster properties of earlier builds, and fix `updateClusterOptions` throwing when it adds or removes a `reduce` function ([#225](https://github.com/maplibre/geojson-vt/pull/225)) (by [@birkskyum](https://github.com/birkskyum))
- Limit the cluster `minZoom` and `maxZoom` to 30, the highest zoom level a cluster id can hold ([#229](https://github.com/maplibre/geojson-vt/pull/229)) (by [@birkskyum](https://github.com/birkskyum))

## 6.1.2

### 🐞 Bug fixes

- Fixed `simplify`'s recursion call stack error ([#218](https://github.com/maplibre/geojson-vt/pull/218)) (by [@HarelM](https://github.com/HarelM))

## 6.1.1

### 🐞 Bug fixes

- Limit recursion depth ([#156](https://github.com/maplibre/geojson-vt/pull/156)) (by [@HarelM](https://github.com/HarelM))

## 6.1.0

### ✨ Features and improvements

- Improve update perfromance on large arrays ([#99](https://github.com/maplibre/geojson-vt/pull/99)) (by [@HarelM](https://github.com/HarelM))
- Remove internally exported fields from geojsonvt API ([#100](https://github.com/maplibre/geojson-vt/pull/100)) (by [@HarelM](https://github.com/HarelM))

## 6.0.5

### ✨ Features and improvements

- Optimization: Dividing memory usage by almost 3 ([#88](https://github.com/maplibre/geojson-vt/pull/88)) (by [@xavierjs](https://github.com/xavierjs))

### 🐞 Bug fixes

- Fix issue with updates related to add with `promoteId` ([#97](https://github.com/maplibre/geojson-vt/pull/97)) (by [@HarelM](https://github.com/HarelM))


## 6.0.4

### 🐞 Bug fixes

- Fix: lower TypeScript target to ES2020 for bundler compatibility ([#79](https://github.com/maplibre/geojson-vt/pull/79)) (by [@claudiobgit](https://github.com/claudiobgit))

## 6.0.3

### 🐞 Bug fixes

- Fixed goejson updates in case of antimaridian crossing. ([#74](https://github.com/maplibre/geojson-vt/pull/74)) (by [@HarelM](https://github.com/HarelM) and [wayofthefuture](https://github.com/wayofthefuture))

## 6.0.2

### 🐞 Bug fixes

- Fix for getTile when cluster index was not initialized ([#70](https://github.com/maplibre/geojson-vt/pull/70)) (by [@HarelM](https://github.com/HarelM))

## 6.0.1

### ✨ Features and improvements

- Export geojsonvt clip start and end values ([#61](https://github.com/maplibre/geojson-vt/pull/61)) (by [HarelM](https://github.com/HarelM))

## 6.0.0

### ✨ Features and improvements

- ⚠️ Removed default export in favor of named exports - breaking change - use `new GeoJSONVT(...)` instead of `geojsonvt(...)`, replaced `mapbox_clip_*` properties with `geojsonvt_clip_*` ([#58](https://github.com/maplibre/geojson-vt/pull/58)) (by [HarelM](https://github.com/HarelM)) 
- Add supercluster to updateable geojsonvt ([#52](https://github.com/maplibre/geojson-vt/pull/52)) (by [wayofthefuture](https://github.com/wayofthefuture) and [HarelM](https://github.com/HarelM)) 
- Add `geoJSONToTile` function to generate a single tile directly from GeoJSON without building the full tile index. ([#38](https://github.com/maplibre/geojson-vt/pull/38)) (by [montzkie18](https://github.com/montzkie18) and [lucaswoj](https://github.com/lucaswoj)).
- Add getData and filter functions for GeoJSON worker support. ([#41](https://github.com/maplibre/geojson-vt/pull/41)) (by [wayofthefuture](https://github.com/wayofthefuture))
- Copy supercluster and typescripify ([#37](https://github.com/maplibre/geojson-vt/pull/37)) (by [wayofthefuture](https://github.com/wayofthefuture))

## 5.0.4

### ✨ Features and improvements

- Fix missing typescript declaration files ([#27](https://github.com/maplibre/geojson-vt/pull/27)) (by [HarelM](https://github.com/HarelM))

## 5.0.3

### ✨ Features and improvements

- Fix external types names and definition after the typescript migration ([#25](https://github.com/maplibre/geojson-vt/pull/25)) (by [HarelM](https://github.com/HarelM))

## 5.0.2

### ✨ Features and improvements

- Increase coverage to 100% ([#11](https://github.com/maplibre/geojson-vt/pull/11)) (by [wayofthefuture](https://github.com/wayofthefuture))
- Move to use switch case stamenets and migrate tests to use vitest ([#16](https://github.com/maplibre/geojson-vt/pull/16)) (by [HarelM](https://github.com/HarelM))
- Migrate code to typescript and added strict checks ([#17](https://github.com/maplibre/geojson-vt/pull/17), [#15](https://github.com/maplibre/geojson-vt/pull/17)) (by [HarelM](https://github.com/HarelM))
- Some de-nesting, organizing, and readability improvements. ([#20](https://github.com/maplibre/geojson-vt/pull/20)) (by [wayofthefuture](https://github.com/wayofthefuture))

## 5.0.1

### ✨ Features and improvements

- Add CI, coverage etc ([#1](https://github.com/maplibre/geojson-vt/pull/1)), ([#4](https://github.com/maplibre/geojson-vt/pull/4)) (by [HarelM](https://github.com/HarelM))

## 5.0.0

### ✨ Features and improvements

- This is the first version, and as such it was manually published.
- Added support for index updates (by [wayofthefuture](https://github.com/wayofthefuture))

## 4.0.5

This is a version from before the fork.
Changes there might be covered in @mapbox/geojson-vt repo.
