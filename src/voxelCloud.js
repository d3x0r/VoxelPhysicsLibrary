
import "./three.js/three.min.js";
import "./three.js/personalFill.js";

import "./tfjs/tf.min.js";

/*  Voxel math ideals
 *    it could be possible to establish that there are distinct values for N such that
 *    
 *
 *
 */


/*
 * voxelUtil.rayCast usage....
 *

            var o = scope.mouseRay.o;
            var result;
            result = rayCast( cluster, scope.mouseRay.o, scope.mouseRay.n )

            if( Voxelarium.selector.currentVoxel )
              Voxelarium.selector.currentVoxel.delete();

            if( result ) {
                Voxelarium.selector.currentAddVoxel = cluster.getVoxelRef( false, result.PredPointedVoxel.x, result.PredPointedVoxel.y, result.PredPointedVoxel.z )
              Voxelarium.selector.currentVoxel = result.ref;

 *
 */


const scope = {
	clusters : [], // list of all current clusters.
};

const maxVolume = 1.0;    // 1 cubic meter.
const maxSteps = 20;
const radiusLookup = [];

for( let junk = 0; junk < 100; junk++ ) {
	// =((Volume/PI())*(4/3))^(1/3)
	radiusLookup.push( Math.cbrt( ( maxVolume/maxSteps) * junk * 4/ (3 *Math.PI)) );
}

const raycastResult = {
	PredPointedVoxel : null,
	PointedVoxel : null,
	ref : null
};

const tests = [ { prime:'x', primeN:0, out:'h' },
		{ prime:'y', primeN:1, out:'v' },
		{ prime:'z', primeN:2, out:'s' },
	];

const voxelUtil = {
}

//           VoxelSpace
//----------------------------- The thing used to track a universe - or do operations between clouds 


function VoxelSpace() {
	this.clouds = [];
}
VoxelSpace.prototype.add = function(cloud ) {
	this.clouds.push(cloud);
	
}

VoxelSpace.prototype.hit = function( ray ) {
	// test ray intersection with clouds in space.
	
}



//           VoxelZone
//----------------------------- A rigid-ish volume of voxels.  Has a self contained size and scale; contains a grid anchored at the origin.
//  Zones are a lot like clouds, but page in visible sectors... 
// they use a cloud themselves for storage, but are not loaded all at once.


function VoxelZone() {
	const cloud = new VoxelCloud();
}


//           VoxelShape
//----------------------------- 
//  Shape is a union of several clouds that are related with constraints (joints)
//  A shape is still a discrete volume; unlike a zone which is boundless.



function VoxelShape() {
	// each sub-cloud has its own relative size.
	this.clouds = [];
}

//           VoxelCloud
//----------------------------- A rigid-ish volume of voxels.  Has a self contained size and scale; contains a grid anchored at the origin.


function VoxelCloud() {
	this.voxelUnitSize = 1.0;
	this.unitUnits = 100;  // a full voxel has no more than 100 volume units.
			       // an empty voxel has 0 units
			       // 

	this.state = 1.0;      // 1.0 = solid, 0.0 = void, -1.0 = liquid (semi-collide) ?

	this.softness = 0.0;   // 0.0 is rigid - the voxels do not deform from their base state.
			       // 1.0 is liquid(?) - the voxels transfer a volume of the ( force / density ) * time * softness

	this.restitution = 1.0; // how much the displacement force recovers.  1.0 is perfect resillience.
				// 0.0 is perfectly dampened.  Collisions happen, and stop, and do not bounce.

	this.maleability = 0.0; // this is how much the shape changes vs how much the force is stored in counterspace.

	this.rolling_friction_ = 0.9; // this is inverse of friction really; only applied in contact
	                              // with some other surface, applies to self.
	                              // 0.0 = infinite friction; no idle velocity kept.  point-cube
	                              // 1.0 is frictionless rolling; 100% idle velocity is kept point-sphere

	this.adhesion = 0.0; // this is how 'sticky' the thing is. 0.0 is not sticky, 1.0 is a desire to stay in contact with
	                     // a colliding point cloud.  (water drops adhere, so they will stay attached to a inverted surface)
	                     // adhesion affects rolling?

	this.repulsion = 0.0; // this is how 'phobic' the thing is.  0.0 is indifference.  1.0 is a desire to put space between
	                      // this is inverse to adhesion; and this applies to the other contact
	                      // so effective adhesion is (self.adhesion - contact.repulsion) (normally bottomed-out to 0?) electrostatic repulsion?

	// magnetic characteristic has a direction-oriented pole, so poles have to align
	// probably as a pure-directional quaternion.
	// can extract 'forward' as required.
	// this.pole dot target.pole  = -1->1
	// torq = sqrt(this.magnetism * contact.magnetism) * (-dot + 1)/2 // between 0.0 and 1.0
	// this.angVel += time * torq * (this.pole-target.pole)
	// relative distance is 1/d ^ (1/3)
	this.pole = [0,1,0,1];
	this.magnetism = 0.0; // non-magnetic.  -1.0 is diamagnetic, 1.0 is paramagnetic

	this.fieldScalar = 1.0; // ? how big fields are... they extend according to the density of the sphere


	this.dims = [];
        this.origin = new THREE.Vector3(); // data origin
        this.orient = new THREE.Matrix();  // direction // Quat?
        this.centroid = new THREE.Vector3(); // mass origin
	this.grids = new Map(); // this cloud has grids.

	this.velocity = [0,0,0];//tf.
	// non-gravitational acceleration
	this.density =  7.0;   // unit mass
	this.density_ = 1/this.density;

	this.angVel = [0,0,0];
	this.angularDensity_ = [1,1,1]; // inverted density?  1/0 = 1?

}


VoxelCloud.prototype.get = function(x,y,z) {
	var id = '' + x + y + z;
	
	var grid = this.grids.get(id);
	if( !grid ) {
		grid = new VoxelGrid(this, x, y, z );
		//grid.cx = x; grid.cy = y; grid.cz = z;
		this.grids.set(id,grid );
	}
	return grid;
}


VoxelCloud.prototype.toGrid = function(o ) {	
	const r = { r: [], o:[], s:[], p: 0, id: '', grid: null };
	const unit = this.voxelUnitSize;
	var scalar = 1;
	for( let i = 0; i < this.dims.length; i++ ) {
		let t;
		// o is a x,y,z universe coordinate
		// each voxel is a unitSize (32.0 for example) that x 0-32 is voxel 0.
		// then each voxel is in a grid by dimensions specified.
		r.r.push( t = Math.floor( Math.floor( o[i] / this.voxelUnitSize ) /this.dims[i]) );
		r.p *= scalar;
		r.s.push(scalar);
		r.o.push(o[i]/unit);
		scalar *= this.dims[i];
		
		r.p += t;
		r.id += t;
	}
	// if there is a grid... otherwise we can only compute the position.
	r.grid = this.grids.get( r.id );
	return r;
}

function pointDistance( p, o, n ) {
	// length( o-p  - ( o-p)dot n ) n ) 
	//
	var t = [o[0]-p[0],o[1]-p[1],o[2]-p[2] ];
	var dn = t[0]*n[0]+t[1]*n[1]+t[2]*n[2];
	n[0] *= dn;
	n[1] *= dn;
	n[2] *= dn;
	return Math.sqrt( n[0]*n[0]+n[1]*n[1]+n[2]+n[2] );
}
function pointDistanceT( p, o, n ) {
	// length( o-p  - ( o-p)dot n ) n ) 
	//
	var t = new THREE.Vector3();
	t.sub( o, p );
	var dn = t.dot(n);
	n.multiplyScalar(dn);
	return n.length();
}

VoxelCloud.prototype.rayCast = function( o, forward )
	{
		const cloudPos = this.toGrid( o );
		const unit = this.voxelUnitSize;
		const grid = cloudPos.grid
		var Out = null;

		var Delta = { h : THREE.Vector4Pool.new(),v : THREE.Vector4Pool.new(),s : THREE.Vector4Pool.new() };
		// these are pure i,j,k normals.
		var Norm = { h : THREE.Vector3Pool.new(), v : THREE.Vector3Pool.new(), s : THREE.Vector3Pool.new() };
		var Collision = { h: THREE.Vector4Pool.new(), v : THREE.Vector4Pool.new(), s : THREE.Vector4Pool.new() };

		var ActualCube_x,ActualCube_y,ActualCube_z;
		var PriorCube_x,PriorCube_y,PriorCube_z;
		var NewCube_x,NewCube_y,NewCube_z;
		var Collide_X, Collide_Y, Collide_Z;
		var i;

		var Norm = forward;
		Norm.multiplyScalar( 1/unit );
        
		Collide = { X :false,y:false,z:false };
        	// setup unit marchers.
		for( let test of tests ) {
			if( Norm[test.prime] >= 0.01 ) {
				collide[test.prime] = true;
				const d = Delta[test.out];
				d.x = Norm.x / Norm[test.prime];
				d.y = Norm.y / Norm[test.prime];
				d.z = Norm.z / Norm[test.prime];
				// d[test.prime] = 1.0;
				d.w = 0;
				d.w = Delta[test.out].length();
                                const c = Collision[test.out];
				const del = (c[test.prime] - o[test.primeN])
				c.x = del * d.x + o.x;
				c.y = del * d.y + o.y;
				c.z = del * d.z + o.z;
				c[test.prime] = (cloudPos.o[test.prime]) + 1.0;

				c.w = del * d.w;
				const n = Norm[test.out];
				n.x = 0;
				n.y = 0;
				n.z = 0;
				n[test.prime] = off[test.prime]/2;
			}
			else if (Norm.x <= -0.01)
			{
				collide[test.prime] = true;
				const d = Delta[test.out];
				d.x = Norm.x / -Norm[test.prime];
				d.y = Norm.y / -Norm[test.prime];
				d.z = Norm.z / -Norm[test.prime];
				// d[test.prime] = 1.0;
				d.w = 0;
				d.w = Delta[test.out].length();
                                const c = Collision[test.out];
				const del = ([test.prime] - o[test.prime])
				c.x = del * d.x + o.x;
				c.y = del * d.y + o.y;
				c.z = del * d.z + o.z;
				c[test.prime] = (cloudPos.o[test.prime]) + 1.0;

				const n = Norm[test.out];
				n.x = 0;
				n.y = 0;
				n.z = 0;
				n[test.prime] = off[test.prime]/2;
			}
		}
        

	var Match= { h : 0, v: 0, s: 0 };
	var Cycle = 1;
	var MinW = 1000000.0;
	var ref;
	//console.log( '-------------------------');
	for (Cycle=0;Cycle<50;Cycle++)
	{
		// Horizontal X axis.
		if (Collide.X)
		{
			if (Match.h==0 && Collision.h.w < MinW)
			{
				ActualCube_x = Math.floor((Collision.h.x));
				ActualCube_y = Math.floor((Collision.h.y));
				ActualCube_z = Math.floor((Collision.h.z));
				NewCube_x = Math.floor((Collision.h.x+Delta.h.x));
				NewCube_y = Math.floor((Collision.h.y+Delta.h.y));
				NewCube_z = Math.floor((Collision.h.z+Delta.h.z));

				here = grid.point[NewCube_x*cloudPos.s[0]+NewCube_y*cloudPos.s[1]+NewCube_z*cloudPos.s[2]];
				let d = pointDistance( [NewCube_x,NewCube_y,NewCube_z], cloudPos.o, Collision.h );
				// can compare the minimum distance to the center scaled
				// by this point; but it's fine; it's a near point.
				if( here > 0 && radiusLookup[here] > d ) {
					// sort of a fail.. 
					if( ( ref = cluster.getVoxelRef( false, NewCube_x, NewCube_y, NewCube_z) ) && ref.sector)
					{
						  //console.log( `x check ${NewCube_x}  ${NewCube_y}  ${NewCube_z}    ${ActualCube_x} ${ActualCube_y} ${ActualCube_z}  ${MinW}  ${Collision.h.w}`)
						out = raycastResult;
						Out.PredPointedVoxel = new THREE.Vector3( ActualCube_x, ActualCube_y, ActualCube_z );
						Out.PointedVoxel = new THREE.Vector3( NewCube_x, NewCube_y, NewCube_z );
						Out.ref = ref;
						// printf(" MATCH.h: %lf\n",Collision.h.w);
						Match.h = Cycle;
						MinW = Collision.h.w;
					} else if( ref ) ref.delete();
				}
				
			}
		}

		// Horizontal Z axis.

		if (Collide.z)
		{
			if (Match.s == 0 && Collision.s.w < MinW)
			{
				ActualCube_x = Math.floor((Collision.s.x));
				ActualCube_y = Math.floor((Collision.s.y));
				ActualCube_z = Math.floor((Collision.s.z));
				NewCube_x = Math.floor((Collision.s.x+Delta.s.x));
				NewCube_y = Math.floor((Collision.s.y+Delta.s.y));
				NewCube_z = Math.floor((Collision.s.z+Delta.s.z));
				here = grid.point[NewCube_x*cloudPos.s[0]+NewCube_y*cloudPos.s[1]+NewCube_z*cloudPos.s[2]]
				let d = pointDistance( [NewCube_x,NewCube_y,NewCube_z], cloudPos.o, Collision.s );
				// can compare the minimum distance to the center scaled
				// by this point; but it's fine; it's a near point.
				if( here > 0 && radiusLookup[here] > d ) {
					//console.log( `z check ${NewCube_x}  ${NewCube_y}  ${NewCube_z}  ${MinW}  ${Collision.s.w} `)
					if( ( ref = cluster.getVoxelRef( false, NewCube_x, NewCube_y, NewCube_z) ) && ref.sector && !ref.voxelType.properties.Is_PlayerCanPassThrough)
					{
						  //console.log( `z check ${NewCube_x}  ${NewCube_y}  ${NewCube_z}  ${MinW}  ${Collision.s.w} `)
						out = raycastResult;
						Out.PredPointedVoxel = new THREE.Vector3( ActualCube_x, ActualCube_y, ActualCube_z );
						Out.PointedVoxel = new THREE.Vector3( NewCube_x, NewCube_y, NewCube_z );
						Out.ref = ref;
						// printf(" MATCH.s: %lf\n",Collision.s.w);
						Match.s = Cycle;
						MinW = Collision.s.w;
					} else if( ref ) ref.delete();
				}
			}
		}

		// Vertical Y axis.

		if (Collide.y)
		{
			if (Match.v==0 && Collision.v.w < MinW)
			{
				ActualCube_x = Math.floor((Collision.v.x));
				ActualCube_y = Math.floor((Collision.v.y));
				ActualCube_z = Math.floor((Collision.v.z));
				NewCube_x = Math.floor((Collision.v.x+Delta.v.x));
				NewCube_y = Math.floor((Collision.v.y+Delta.v.y));
				NewCube_z = Math.floor((Collision.v.z+Delta.v.z));

				here = grid.point[NewCube_x*cloudPos.s[0]+NewCube_y*cloudPos.s[1]+NewCube_z*cloudPos.s[2]]
				let d = pointDistance( [NewCube_x,NewCube_y,NewCube_z], cloudPos.o, Collision.v );
				// can compare the minimum distance to the center scaled
				// by this point; but it's fine; it's a near point.
				if( here > 0 && radiusLookup[here] > d ) {
					if( ( ref = cluster.getVoxelRef( false, NewCube_x, NewCube_y, NewCube_z) ) && ref.sector && !ref.voxelType.properties.Is_PlayerCanPassThrough )
					{
						//console.log( `y check ${NewCube_x}  ${NewCube_y}  ${NewCube_z}  ${MinW}  ${Collision.v.w} `)
						out = raycastResult;
						Out.PredPointedVoxel = new THREE.Vector3( ActualCube_x, ActualCube_y, ActualCube_z );
						Out.PointedVoxel = new THREE.Vector3( NewCube_x, NewCube_y, NewCube_z );
						Out.PointedVoxel = new THREE.Vector3( NewCube_x, NewCube_y, NewCube_z );
						Out.ref = ref;
						// printf(" MATCH.v: %lf\n",Collision.v.w);
						Match.v = Cycle;
						MinW = Collision.v.w;
					} else if( ref ) ref.delete();
				}
			}
		}

		//printf(" Match (H:%lf S:%lf V:%lf) \n", Collision.h.w, Collision.s.w, Collision.v.w);
		if( Match.h>0 && Match.s>0 && Match.v>0 ) return Out; // any other collision will be further anyway.  This is the best.

		Collision.h.x += Delta.h.x; Collision.h.y += Delta.h.y; Collision.h.z += Delta.h.z; Collision.h.w += Delta.h.w;
		Collision.v.x += Delta.v.x; Collision.v.y += Delta.v.y; Collision.v.z += Delta.v.z; Collision.v.w += Delta.v.w;
		Collision.s.x += Delta.s.x; Collision.s.y += Delta.s.y; Collision.s.z += Delta.s.z; Collision.s.w += Delta.s.w;
	}
	Delta.h.delete();
	Delta.v.delete();
	Delta.s.delete();
	Norm.h.delete();
	Norm.v.delete();
	Norm.s.delete();
	Collision.h.delete();
	Collision.v.delete();
	Collision.s.delete();

	return Out;
}

/*

VoxelCloud.prototype.getVoxelRef = function( is3dSpaceCoords, x, y, z ) {
            if( is3dSpaceCoords ) {
              x = Math.floor( x / this.voxelUnitSize );
              y = Math.floor( y / this.voxelUnitSize );
              z = Math.floor( z / this.voxelUnitSize );
            }
            var sx = Math.floor( x / this.sectorSizeX );
            var sy = Math.floor( y / this.sectorSizeY );
            var sz = Math.floor( z / this.sectorSizeZ );
            //if( !is3dSpaceCoords) {
              //console.log( `Get ${sx} ${sy} ${sz}`)
            //}
            var sector = cluster.getSector( sx, sy, sz, true );
            if( sector ) {
                return sector.getVoxelRef( x % this.sectorSizeX, y % this.sectorSizeY, z % this.sectorSizeZ);
            } else {
                // pass world coordinates, since there's no sector to give a base position
                return Voxelarium.VoxelRef( cluster, null, x, y, z );
 function makeVoxelRef( cluster, sector, x, y, z )
{
	var result;
	result = refPool.pop();
	if( !result ) {
		result = { sector : sector
				, offset : 0
				, x : x, y : y, z : z
			 	, wx : sector?(sector.pos.x * cluster.sectorSizeX + x):x
				, wy : sector?(sector.pos.y * cluster.sectorSizeY + y):y
				, wz : sector?(sector.pos.z * cluster.sectorSizeZ + z):z
				, voxelType : null
				, cluster : cluster
				, voxelExtension : null
				, forEach : forEach
				, delete : function() { refPool.push( this ); }
				, clone : function() { return this.sector.getVoxelRef( this.x, this.y, this.z ) }
				, getNearVoxel : GetVoxelRef
				 }
		Object.seal( result );
	}
	else {
		result.sector = sector;
		result.offset = 0;
		result.x = x;
		result.y = y;
		result.z = z;
		result.wx = sector?(sector.pos.x * cluster.sectorSizeX + x):x
		result.wy = sector?(sector.pos.y * cluster.sectorSizeY + y):y
		result.wz = sector?(sector.pos.z * cluster.sectorSizeZ + z):z
		result.voxelType = null;
		result.cluster = cluster;
		result.voxelExtension = null;
	}
    if( sector ) {
		// wx coords will still be accurate even if the sub-range and origin sector move now.
		if( result.x < 0 ) { result.x += cluster.sectorSizeX; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.RIGHT] || result.sector ) }
		if( result.y < 0 ) { result.y += cluster.sectorSizeY; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.BELOW] || result.sector ) }
		if( result.z < 0 ) { result.z += cluster.sectorSizeZ; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.AHEAD] || result.sector ) }
		if( result.x >= cluster.sectorSizeX ) { result.x -= cluster.sectorSizeX; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.LEFT] || result.sector ) }
		if( result.y >= cluster.sectorSizeY ) { result.y += cluster.sectorSizeY; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.ABOVE] || result.sector ) }
		if( result.z >= cluster.sectorSizeZ ) { result.z += cluster.sectorSizeZ; result.sector = ( result.sector && result.sector.near_sectors[Voxelarium.RelativeVoxelOrds.BEHIND] || result.sector ) }

		result.offset = ( result.x * cluster.sectorSizeY )  + result.y + ( result.z * ( cluster.sectorSizeY * cluster.sectorSizeX ) );
		  result.voxelType = sector.data.data[result.offset]
		  if( !result.voxelType )
		  	return null;
		  result.voxelExtension = sector.data.otherInfos[result.offset];
    }
	return result;
}
           }
            return null;
        }
}
*/

function VoxelGrid( cloud, x, y, z ) {
	// dimsional description is found in the cloud this grid is part of...
	if( cloud ) {
		
		this.groundTruth = tf.buffer( cloud.dims );
		this.points = cloud. tf.buffer(cloud.dims );
		this.cx = x; // in units of cloud dimensions.  All grids within a cloud are the same size.
		this.cy = y;
		this.cz = z;
	} else {

		this.groundTruth = []; // shape returns to this shape.
		this.points = [];  // values at each x,y,z centroid that describes amount of presence; original groundTruth;
		this.counter = [];  // counter-space value of deformation (information about force that isn't included in a point deformation)
		this.deformationBits = null; //Uint8Array(0); // points which are not at ground truth or have counter-space.

		this.spoctree = new SphereOctree();

		this.cx = 0; // in units of cloud dimensions.  All grids within a cloud are the same size.
		this.cy = 0;
		this.cz = 0;
	}
}

VoxelGrid.prototype.

function SphereOctree() {
	// this is used to track point-centroid collision points.
	this.levels = [];

	this.childNodes = [null,null,null,null
	                  ,null,null,null,null];


}

export {VoxelSpace, VoxelCloud, voxelUtil };


{
// Define a model for linear regression.
const model = tf.sequential();
model.add(tf.layers.dense({units: 1, inputShape: [1]}));

model.compile({loss: 'meanSquaredError', optimizer: 'sgd'});

// Generate some synthetic data for training.
const xs = tf.tensor2d([1, 2, 3, 4], [4, 1]);
const ys = tf.tensor2d([1, 3, 5, 7], [4, 1]);

// Train the model using the data.
model.fit(xs, ys, {epochs: 10}).then(() => {
  // Use the model to do inference on a data point the model hasn't seen before:
  model.predict(tf.tensor2d([5], [1, 1])).print();
  // Open the browser devtools to see the output
});
}
