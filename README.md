# Voxel Physics Library - VPL

This is a test collider; shell development of octrees divided by spheres instead of planes.

Input Voxel Grid is assume to be a `(x,y,z)` sized array of values.  
This is defined as `dims = [x,y,z]`;.  `dim0` is a constant that is the x dimension...



### The Ruler

There is a simple way to make a ruler for an axis...

``` js
// basically a yardstick that converts a coordinate at a depth to an index.
function octRuler( x, depth ) {
	const stepx = 1 << ( depth);
        const Nx = (1 << ( depth -1 ))-1;
        return ( x*stepx + Nx );
}

//the value along the axis may be between 0 and octRuler( 1, level );
// 0 = 1
// 1 = 2
// 2 = 4 ... 

var physicalLocation = octRuler( 0, (depth - currentLevel ) );
// physical Location is the index along the ruler given that depth of tree and current level in the tree.


```

### The Locator

And then simply applying that in 3 dimensions; using the same level for all directions...
The result of this can be interpreted in various ways.  In one aspect, it becomes a index into the point cloud with 
`result[0] + result[1] * dim0 + result[2] * dim0 * dim1`
or the spacial location of this point is `(grid_origin + result + 1)` ~ `(grid_origin[0]+result[0]+1, ...0`.

``` js
const octEntResult = [0,0,0];
function octEnt( x, y, z, level, depth ) {
	const stepx = 1 << ( depth-level);
        const Nx = (1 << ( depth - level -1 ))-1;
        octEntResult[0] = ( x*stepx + Nx );
	octEntResult[1] = ( y*stepx + Nx );
	octEntResult[2] = ( z*stepx + Nx );
        return octEntResult;
}

function octEnt2( x, y, z, level, depth ) {
        octEntResult[0] = octRuler( x, depth-level );
        octEntResult[1] = octRuler( y, depth-level );
        octEntResult[2] = octRuler( z, depth-level );
        return octEntResult;
}


```

### The Bit Indexer

But what I really needed is the index into a truncated bit array.  The bit array tracks whether an octant has content or not.  The first level only has 1 bit.
The second level has 8 more bits, for a total of 9...
While, the locator can also be used to get the index into a grid for a bit, with indexer similar to the point cloud data, It would be more
cache friendly to put the first levels of the tree together; after the first 2-3 levels of indexing it's not going to matter a lot.

``` js
function octIndex( x, level ) {
	let base = 0;
	for( let t = 0; t <= level; t++ ) base += 1<<(t*3);
	return base + (x * 8);
}


var octBitIndex = octIndex( x, level ) + octantIndex;
var octBit = octantBitArray[ octBitIndex / 32 ] & ( 1 << (octBitIndex & 31) );
// octBit is set if the specified octant under this one has content.

```

### The Caster

Okay, so then Using the above we can build a tree...


``` js

const circumscribeScalar = Math.sqrt(3); // circumscribed cubes

function rayCast( origin, normal ){ // get content (if any) in this direction
	
        var level = 0;
        let size = octRuler( 1, depth-level );
        
        var r = checkNode( 0, 0, 0 );
        console.log( "Hit at:", r );
        return r;
        
        function checkNode(x,y,z) {
	        let base=octEnt( x, y, z, level, depth );
		base[0] += 1; base[1] += 1; base[2] += 1; // this is offset from the real data by 0.5,
		                                          // which itself is offset by 0.5 from base axis.
        	console.log( "checkhit:", x, y, z );
		let r = circumscribeScalar*1<<(1+depth-level);
	        let d = pointDistance( base, o, n ); // get distance from point
        	if( d < r ) {
	        	let index = base[0]+base[1]*dim0+base[2]*dim1*dim0;
	        	if(octBits[index>>5] & index&0x1f) // can just descend and find a terminal point always?
			{
        			const test = octOrder[dir]; // not sure if order of collision really matters? 
				                            //  Need closest collision...  (defined in src/octeretree.js)
                	        level++; 
				if( level >= depth ) {
					console.log( "Reached max depth - pretend we hit something." );
					level--; return 7;
				}
                        	for( var tid = 0; tid < 8; tid++ ) {
                                	const i = octIndex[test[tid]];
                                        let r = checkNode( x*2+i[0], y*2+i[1], z*2+i[2] );
                                        if( r ) {
						level--;
	                                        return (r<<3)+test[tid]; // resulting octal digits reveal the path of octants taken?
                                        }
                        	}
				level--;
                        }
	        }
		return 0;
        }
        
}
}

```

### The Builder

And, to be really effective, values should be setup in the bit array at least...


```

var depth = 100; /// 2^100 depth should be quite a good resolution?

function octeretree() {
	let level = depth-1;
	// this builds bits in an octree...
	const xsize = octSize( level );
	// highest level first; interprets the raw data presense/abense.
	for( let z = 0; (z < (dim2+1)/2); z++ ) 
		for( let y = 0; (y < (dim1+1)/2); y++ )
			for( let x = 0; (x < (dim0+1)/2); x++ ) {
				let bits = 0;
				// this is probably faster unrolled; and constants substituted.
				for( let oct = 0; oct < 8; oct++ ) {
					if( ( ( x*2 + octIndex[oct][0] ) < dim0 ) 
					  &&( ( y*2 + octIndex[oct][1] ) < dim1 )
					  &&( ( z*2 + octIndex[oct][2] ) < dim2 ) )
					if( (-data[x*2 + octIndex[oct][0]+(y*2 + octIndex[oct][1])*dim0+(z*2 + octIndex[oct][2])*dim0*dim1] ) > 0 ) {
						bits |= 1 << oct;
					}
				}
				octBytes[ octBitIndex(x + y*xsize + z*xsize*xsize, level)] = bits;
			}
		
	level--; // remaining levels... read prior level for presense
	for( ; level > 0; level-- ) {
		const xsize = octSize(  level );
		const nsize = octSize(  level+1 ); // need the size on next level
		for( let z = 0; z < xsize && z < dim2; z++ ) 
			for( let y = 0; y < xsize && y < dim1; y++ )
				for( let x = 0; x < xsize && x < dim0; x++ ) {
					const base = x + y*xsize + z*xsize*xsize;
					var bits = 0;
					// this is probably faster unrolled; and constants substituted.
					for( let oct = 0; oct < 8; oct++ ) {
						const childBase = (x*2+octIndex[oct][0]) +(y*2+octIndex[oct][1])*nsize+(z*2+octIndex[oct][2])*nsize*nsize;
						if( octBytes[ (((Math.pow(8,(level+1)))-1)/7) + (childBase)-1 ] )
							bits |= 1 << oct;
					}
					octBytes[ octBitIndex(base, level) ] = bits;
				}
	}
}		


```

###

On combining angular and linear velocity - this is only a matter at the exact points of impact.
The centroid of the leaf nodes in contact should calculate their full relative velocity using the base body velocity plus any velocity from rotation; 
This will give a total force of impact for its given density.



## References (maybe)

// This is exactly where this is heading. (sort of; this is still on an arbitrary mesh)
https://upcommons.upc.edu/bitstream/handle/2117/84837/R05-23.pdf


this is actually pretty old (2010)  section 6.2 Beam Optimization  ; Efficient Sparse Voxel Octrees – Analysis, Extensions, and Implementation 
https://users.aalto.fi/~laines9/publications/laine2010tr1_paper.pdf



http://isg.cs.tcd.ie/cosulliv/Pubs/spheres.pdf

External proof of concept - uses arbitrary mesh clouds.
https://github.com/Simon089/SphereOctree (also mentions 'miniball' https://people.inf.ethz.ch/gaertner/subdir/software/miniball.html  which is a closest-sphere calculation.)

HERO algorithm; using bitmasks to trace steps and history of path...
https://diglib.eg.org/bitstream/handle/10.2312/EGGH.EGGH89.061-073/061-073.pdf?sequence=1&isAllowed=y

For re-projecting voxel volumes into other volumes. (for merging static physics collisions)
https://arxiv.org/pdf/1412.4941.pdf ( An exact general remeshing scheme applied to physically conservative voxelization? )

http://isg.cs.tcd.ie/cosulliv/Pubs/spheres.pdf (about just spheres as a basis collider) (has centroid of octree)

// rocket phsyics of tethered, rotating spacecraft
https://docs.lib.purdue.edu/cgi/viewcontent.cgi?article=1435&context=open_access_dissertations

https://www.euclideanspace.com/physics/kinematics/combinedVelocity/index.htm  https://www.euclideanspace.com/physics/kinematics/combinedVelocity/index.htm
https://isaacphysics.org/concepts/cp_ang_eq_of_motion

https://openstax.org/books/university-physics-volume-1/pages/3-6-finding-velocity-and-displacement-from-acceleration

https://www.maplesoft.com/content/EngineeringFundamentals/4/MapleDocument_30/Rotation%20MI%20and%20Torque.pdf

(unused; more about like compression)  http://www.cs.utah.edu/~knolla/octiso-rt06.pdf


more on textures

This is a good demonstration of cube-mapping practices including the quarter-slice top/bottom which solves the extreme edge mapping.
http://paulbourke.net/miscellaneous/cubemaps/    (Fixed a* perlin-sphere.js)

```
this is a quad-tree, but the same idea extends directly to octree and spheres instead of circles.  The inner smaller circles, happen to be that that circle is also around a point directly in the data cloud - this turned out to be inaccurate, as measuring that way omits a lot of circles... 22https://d3x0r.org/javascript/VPL/3-level-grid-missing-points.png  (greens and purples)
 And all the circles should really circumscribe the squares and not be inscribed
 Oof. And that probably just gets worse and worse with more dimensions.
 it actually doesn't; and it's a pure binary calculation
 I was having problem with the sequence 1,3,5,7,15 ... trying to figure out the next number
 then it dawned on me it's all really just powers of 2 (31,63...)
 if you don't wory about the grid exactly fitting your model, you can just say you have a 2^n octree projected over any space
 where 2^n is greater than or equal to the point clouds largest dimension
 but then every spacial point is 8 acessess through the tree... although if it can be precomputed, it can be compressed leaving a lot of self-similar space as just 'empty' or 'full'
 s/8/tree depth/
 this other sphere collider even sphere octree I found uses a minimum sphere around those things it contains... which is a lot of computation since you probably need to dive into a quad it anyway... (to insribe instead of circumscribe is just mulitply radius by 1.414  [sqrt(2), sqrt(3) for a cube.])
```
