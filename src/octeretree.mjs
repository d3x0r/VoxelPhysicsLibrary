
import * as THREEd from "./three.js/three.min.js"
const THREE = THREEd.default;
import "./three.js/personalFill.js"

/* 
 *
 
 levels
 		(1 << tree.depth - 1)
    0 = 1 point 0    (half_width*1)  (depth 0)
    	1 point 1    (depth 1)
        1 point 3    (depth 2)
        1 point 7    (depth 3)
        1 point 15   (depth 4)
        1 point 31   (depth 5) 
        
        (  N = (1<<(tree.depth-this.level)-1), N2 = N + (1<<this.level) )
    1 = 2 point (0, ,2) ((depth 1)width of 3)
        2 point (1, ,5) ((depth 2)width of 4/6)
        2 point (3, ,11) (depth 3)(width of 5/12)
        2 point (7, ,23) (depth 4)(width of 6/24)
        2 point (15, ,47)
                
	( N = ( 1 << ( tree.depth - this.level) - 1 ), step = N + 1 << (1+tree.depth-this.level) , count = 1<<this.level
    2 = 4 point (0,2, ,4,6)  ((depth 2) width of 4/6)
        4 point (1,5, ,9,13) (depth 3) width of 
        

	( N = ( 1 << ( tree.depth - this.level) - 1 ), step = N + 1 << (1+tree.depth-this.level) , count = 1<<this.level
    3 = 8 points  (1<<node.level)
    	
    	( 0, 2, 4, 6,  ,8, 10, 12, 14 )  (depth 3)
	( 1, 5, 9, 13,  , 17, 21, 25, 29 ) (depth 4)   

    amazingly - is a binary number progression :)
     1,3,7,15, .. what's the next number?
     
     cubed. 2*2*2 (8) 3*3*3(27) 4*4*4(64)
     
*/

// if one were to want a quadtree, this would be sqrt(2);
const circumscribeScalar = Math.sqrt(3);

const octIndex = [ [0,0,0], [1,0,0], [0,1,0], [1,1,0], [0,0,1], [1,0,1], [0,1,1], [1,1,1] ];
const octBitOffset = [ 0,1,2,3,4,5,6,7 ];

// indexed by [normalBits] [octant collided]
const octOrder = [ [0,1,2,4, 3,6,5,7]
                 , [1,0,3,5, 6,4,7,2]
                 , [2,3,0,6, 5,4,7,1]
                 , [3,1,2,7, 4,6,5,0]
                 , [4,6,5,0, 3,1,2,7]
                 , [5,4,7,1, 2,3,0,6]
                 , [6,4,7,2, 1,0,3,5]
                 , [3,6,5,7, 0,1,2,4]
                 ];
                 
const octOrderInv = [ [0,1,2,4, 7,6,5,7]
				    , [1,0,3,5, 6,4,7,2]
						 , [2,3,0,6, 5,4,7,1]
						 , [3,1,2,7, 4,6,5,0]
						 , [4,6,5,0, 3,1,2,7]
						 , [5,4,7,1, 2,3,0,6]
						 , [6,4,7,2, 1,0,3,5]
						 , [7,6,5,3, 0,1,2,4]
						 ];
						 
		

const OctereTree = function OctereTree( data, dims, bias ) {
	if( this instanceof OctereTree ) throw new Error( "Please do not call this with new." );

	const dim0 = dims[0];
	const dim1 = dims[1];
	const dim2 = dims[2];
			
	const depths = [maxInt(dim0),maxInt(dim1),maxInt(dim2)];
			
	const depth = ( (depths[0]>depths[1])
		?(depths[0]>depths[2])
			?depths[0]
			:depths[2]
		:(depths[1]>depths[2])
			?depths[1]
			:depths[2] );

	const wingHalfSpan = octRuler( 0, depth );

	function maxInt( x ) { 	for( let n = 0; n < 32; n++ ) if( x & ( 1 << 31-n) ) return 32-n; }

	// basically a yardstick that converts a coordinate at a depth to an index.
	function octRuler( x, depth ) {
		if( depth <= 0 )
		 	return 1;
		const stepx = 1 << ( depth);
		const Nx = (1 << ( depth -1 ))-1;
		return ( x*stepx + Nx );
	}

	// basically a yardstick that converts a coordinate at a depth to an index.
	function octSize( depth ) {
		if( depth <= 0 )
		 	return 1;
		return  1 << ( depth);
		
	}

	if(!bias ) bias = [wingHalfSpan-(dim0>>1),wingHalfSpan-(dim1>>1),wingHalfSpan-(dim2>>1)];
	
	// static temporary result buffer.
	const octEntResult = [0,0,0];
	function octEnt( x, y, z, level, depth ) {
		const stepx = 1 << ( depth-level);
		const Nx = (1 << ( depth - level -1 ))-1;
		octEntResult[0] = ( x*stepx + Nx ); octEntResult[1] = (y*stepx+Nx); octEntResult[2] = (z*stepx+Nx);
		return octEntResult;
	}

	// get the base bit index (plus sub-octant x)
	// 
	function octBitIndex( x, level ) {
		if( !level ) throw new Error( "No level above this one");
		return (((Math.pow(8,(level)))-1)/7) + (x)-1;
	}
		

	// the tree will always over-span(or match) the size of the input...
	// have to use the target size of the tree as the size.
	//console.log( "When sizing which do we use? ", dim0*dim1*dim2, depth, (octBitIndex( 0, depth )) );
	console.log( "octree is ", (octBitIndex( 0, depth )+3), "bytes and ", (octBitIndex( 0, depth )+3)*8, "bits for", dim0*dim1*dim2, "values" );
	const octBits = new Uint32Array( (octBitIndex( 0, depth )+3)>>2 ); // round up.
	const octBytes = new Uint8Array( octBits.buffer ); // round up.


	function octeretree() {

		const frame = new THREE.Matrix4();
		const motion = frame.motion;
	
		this.frame = frame;
		this.motion = motion;
	
		this.octBits = octBits;
		this.dim0 = dim0;
		this.dim1 = dim1;
		this.dim2 = dim2;
	
		this.wingHalfSpan = wingHalfSpan;
		const xbias = bias[0];
		const yBias = bias[1];
		const zBias = bias[2];
	
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
						if( ( x*2 + octIndex[oct][0] ) < dim0 )
						if( ( y*2 + octIndex[oct][1] ) < dim1 )
						if( ( z*2 + octIndex[oct][2] ) < dim2 )
						if( (-data[x*2 + octIndex[oct][0]+(y*2 + octIndex[oct][1])*dim0+(z*2 + octIndex[oct][2])*dim0*dim1] ) > 0 ) {
							bits |= 1 << oct;
						}
					}
					octBytes[ octBitIndex((x+y*xsize+z*xsize*xsize), level)] = bits;
				}
			
		level--; // remaining levels... read prior level for presense
		for( ; level > 0; level-- ) {
			const xsize = octSize(  level );
			const nsize = octSize(  level+1 );
			const nsize2 = nsize*nsize;
			for( let z = 0; z < xsize && z < dim2; z++ ) 
				for( let y = 0; y < xsize && y < dim1; y++ )
					for( let x = 0; x < xsize && x < dim0; x++ ) {
						const base = x + y*xsize + z*xsize*xsize;
						var bits = 0;
						// this is probably faster unrolled; and constants substituted.
						for( let oct = 0; oct < 8; oct++ ) {
							const childBase = (x*2+octIndex[oct][0]) +(y*2+octIndex[oct][1])*nsize+(z*2+octIndex[oct][2])*nsize2;
							if( octBytes[ (((Math.pow(8,(level+1)))-1)/7) + (childBase)-1 ] )
								bits |= 1 << oct;
						}
						octBytes[ octBitIndex(base, level) ] = bits;
					}
		}
			
		//dumpOctree( this );
	}


	function dumpOctree( tree ) {
		function pad8( s ){
			// each of these bits are a corner of a cube... which get unfolded into a straight line of bits.
			s = '00000000'.substr(s.length) + s;
			s = s.substr(4)+'~'+s.substr(0,4); // reverse output; put 'back' and then 'front' if 'back' is 'previous slice'
			return s;
		}
		console.log( "Has Content?", !!octBits[0] );
		console.log( "First mip children have ", ( (octBits[0] & 0xff )  ) .toString(2) );
		for( let level = 1; level < depth; level++ ) {
			const size = octSize( level );
			console.log( "\n---------- Dumping Oct Level ", level, " at ", octBitIndex( 0, level ), "depth:", depth, "size:", size );
			for( let z = 0; z < size; z++ ) {
				for( let y = 0; y < size; y++ ) {
					var line = '';
					for( let x = 0; x < size; x++ ) {
						let children = octBytes[ octBitIndex( x+y*size+z*size*size, level ) ];
						// debug info - adds indexes and coordinate information
						//line += (octBitIndex( 0, level ) + x+y*size+z*size*size) + "  " + children + "  |";
						line += children?(pad8(children.toString(2))+" "):"          ";
					}
					console.log( line );
				}
				console.log( '---------------------' );
			}
		}
	}


	function pointDistance( p, o, n ) {
	// array of values version.
		// length( o-p  - ( o-p)dot n ) n ) 
		//
		var t = [o[0]-p[0],o[1]-p[1],o[2]-p[2] ];
		var dn = t[0]*n[0]+t[1]*n[1]+t[2]*n[2];
		t[0] = t[0] - n[0] * dn;
		t[1] = t[1] - n[1] * dn;
		t[2] = t[2] - n[2] * dn;
		return Math.sqrt( t[0]*t[0]+t[1]*t[1]+t[2]*t[2] );
	}
	// three.js vector version
	function pointDistanceT( p, o, n ) {
		// length( o-p  - ( o-p)dot n ) n ) 
		//
		var t = new THREE.Vector3();
		t.sub( o, p );
		var dn = t.dot(n);
		n.multiplyScalar(dn);
		return n.length();
	}


	function dirBits(n) {
		return ((n[0]>0)?0:1) + ((n[1]>0)?0:2) + ((n[2]>0)?0:4);
	}

	octeretree.prototype.raycast = function( o, n ) {
		
		const dir = dirBits(n);
		const this_ = this;

		var r = checkNode( 0, 0, 0, 0 );
		console.log( "Hit at:", r );
		return r;
		
		function checkNode(x,y,z, level) {
			let base=octEnt( x, y, z, level, depth );
			base[0] -= this_.xbias;
			base[1] -= this_.yBias;
			base[2] -= this_.zBias;
			console.log( "checkhit:", x, y, z );
			let r = circumscribeScalar* (1 << (1+depth-level) );
			let d = pointDistance( base, o, n );
			if( d < r ) {
				const width = octSize(level);				        
				//if(octBits[index>>5] & index&0x1f) 
				{
					const test = octOrder[dir];
					if( level >= depth ) {
						console.log( "Reached max depth - pretend we hit something." );
						return 7;
					}
					let index = octBitIndex( base[0]+base[1]*width+base[2]*width, level );
					for( var tid = 0; tid < 8; tid++ ) {
						const i = octIndex[test[tid]];
						// if the target octant has content... 
						if( octBits[(index+test[tid])/32] & ( 1 << ( index+test[tid] & 0x1f ) ) ) {
							let r = checkNode( x*2+i[0], y*2+i[1], z*2+i[2], level+1 );
							if( r ) {
								return (r<<3)+test[tid];
							}
						}
					}
				}
				return 0;
			}
			
		}
	}

	octeretree.prototype.collideTree = collideTree;
	function collideTree( otherTree ) {
		let level = 0; // start at the top level.
		const aOrigin = a.frame.origin;
		const bOrigin = b.frame.origin;
		const directionBToA = a.motion.forward.sub( b.motion.forward );
		const adir = dirBits(directionBToA);
		const bdir = ~adir;
		const testa = octOrder[adir];
		const testb = octOrder[bdir];
		const result = {
			pairs : []
			
		};
		checkOverlap( this, otherTree, 0,0,0, 0 );
		return result;
		function checkOverlap( a, x, y, z, b, bx, by, bz, level ) {
	
			if( level == depth ) {
				console.log( "Colliding real voxel points!", x, y, z, bx, by, bz );
				result.pairs.push( {x:x,y:y,z:z,bx:bx,by:by,bz:bz} );
				return 0;
			}
	
			let origin = a.frame.origin;
			let basea=octEnt( x, y, z, level, depth );
			let rawbasea = [basea[0], basea[1], basea[2]];
			basea = [basea[0] - a.xbias + origin.x, basea[1] - a.ybias + origin.y, basea[2] - a.zbias + origin.z];
	
			origin = b.frame.origin;
			let baseb=octEnt( bx, by, bz, level, depth );
			let rawbaseb = [baseb[0], baseb[1], baseb[2]];
			baseb = [baseb[0] - b.xbias + origin.x, basea[1] - b.ybias + origin.y, basea[2] - b.zbias + origin.z];
	
			const dist = (basea[0]-baseb[0])*(basea[0]-baseb[0])
			   + (basea[1]-baseb[1])*(basea[1]-baseb[1])
			   + (basea[2]-baseb[2])*(basea[2]-baseb[2]);
			 
			if( dist < ( circumscribeScalar*( octRuler(0, 1+depth-level) ) ) ) {
				// test-id
					
				let indexa = octBitIndex( rawbasea[0] + rawbasea[1]*width + rawbasea[2]*width*width, level );
				let indexb = octBitIndex( rawbaseb[0] + rawbaseb[1]*width + rawbaseb[2]*width*width, level );
				for( var tida = 0; tida < 8; tida++ ) {
					const aid = testa[tida];
					// can potentially collide with this one.
					if( a.octBits[(indexa+aid)/32] & ( 1 << ( (indexa+aid )& 0x1f ) ) ) {
						for( var tidb = 0; tidb < 8; tidb++ ) {
							// test all b's that can potentially collide with this one too.
							// 0 or more may collide?
							const bid = testb[tidb];
							// if the target octant has content... 
							if ( b.octBits[(indexb+bid)/32] & ( 1 << ( (indexb+bid )& 0x1f ) ) )
							{
								const bi = octIndex[bid];
								const ai = octIndex[aid];
								let r = checkOverlap( a, x*2+ ai[0], y*2+ai[0],z*2+ai[0], b, bx*2+ bi[0], by*2+bi[0],bz*2+bi[0], level+1 );
								if( r ) return r;
							}
						}
					}
				}
			}
		}
		
	
	}
	
        return new octeretree( );

};

export {OctereTree};
