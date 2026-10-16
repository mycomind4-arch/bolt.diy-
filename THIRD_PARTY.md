# Attribution, data provenance and licenses

## God’s Eye View — code adaptation
Humboldt Atlas adapts the source-provider factory approach and portions of Cesium imagery and terrain provider code from:
https://github.com/bilawalsidhu/gods-eye-view

Copyright (c) 2026 Bilawal Sidhu.
Upstream source license: MIT License (see full notice below).
Adapted code: `src/maps/sources.js`. Changes: streamlined Esri/OSM image loading and failure fallback, keyless Re:Earth terrain, removed non-property intelligence layers, optional Cesium Ion token support.

MIT License — Copyright (c) 2026 Bilawal Sidhu.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Third-party content and data are NOT covered by MIT grant
- Humboldt County GIS public parcel boundaries, layers and attributes: county source, planning and visualization only, accuracy varies. https://humboldtgov.org/GIS
- Esri World Imagery: © Esri, Maxar, Earthstar Geographics, GIS User Community. https://www.esri.com
- OpenStreetMap standard imagery © OpenStreetMap contributors, ODbL/tiles subject to tile usage policy. https://www.openstreetmap.org/copyright
- Re:Earth/Mapterhorn keyless terrain: CC BY 4.0 per God’s Eye View terrain integration; provider can enforce usage limits. https://terrain.reearth.land/
- CesiumJS: Apache 2.0. https://cesium.com/learn/cesiumjs/ref-doc/
- Google Photorealistic 3D is NOT enabled; requires provider-specific account, key, billing and terms.
- Public permit and record links remain subject to county systems and applicable public-access terms.

Never redistribute third-party data sets as if they were licensed under the app's MIT software license.
