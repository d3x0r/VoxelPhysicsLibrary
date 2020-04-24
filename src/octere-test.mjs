
import {OctereTree} from "./octeretree.mjs";

import * as X from "./testdata.mjs";
var meshes = X.createTestData();

var now = Date.now();
var then = now;
var mesh = meshes.Sphere();
console.log( "Magic?", Object.keys(meshes), mesh );
now = Date.now();
var tree = OctereTree( mesh.data, mesh.dims );
console.log( "MIPPING took", Date.now()-now );
var r = tree.raycast( [0,0,0], [Math.sqrt(1/3),Math.sqrt(1/3),Math.sqrt(1/3)] );
console.log( "Path result:", r);



mesh = meshes.Terrain();
console.log( "terrain:", mesh.dims );
now = Date.now();
tree = OctereTree( mesh.data, mesh.dims );
console.log( "MIPPING took", Date.now()-now );


mesh = meshes['Sine Waves']();
console.log( "Sine Waves:", mesh.dims );
now = Date.now();
tree = OctereTree( mesh.data, mesh.dims );
console.log( "MIPPING took", Date.now()-now );
