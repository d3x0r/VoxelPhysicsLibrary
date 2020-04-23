
import {OctereTree} from "./octeretree.mjs";

var tree = OctereTree( [], [100, 100, 100] );
var r = tree.raycast( [0,0,0], [Math.sqrt(1/3),Math.sqrt(1/3),Math.sqrt(1/3)] );
console.log( "Path result:", r.toString(8));
