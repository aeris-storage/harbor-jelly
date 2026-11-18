/* ============================================================
   Dynamic props — ships, cranes, buoys, working boats
   ============================================================ */
function buildShipGeometry(b) {
  // Local origin is the waterline at midship, bow toward +z.
  const o = OBJ.ship;
  const sections = [
    { z: -.735, w: .215, y: .076, b: -.07 },
    { z: -.56, w: .235, y: .082, b: -.14 },
    { z: -.12, w: .235, y: .086, b: -.16 },
    { z: .34, w: .21, y: .102, b: -.12 },
    { z: .60, w: .125, y: .12, b: -.035 },
    { z: .735, w: .018, y: .13, b: .035 }
  ];
  loftHull(b, o, sections, M.hullBlue, C('#7d857e'), MAT.hull);
  // deck plating and bulwark
  b.box(0, .105, -.06, .4, .016, 1.13, C('#8e9388'), MAT.metal, o);
  for (const sx of [-1, 1]) {
    b.box(sx * .215, .14, -.1, .015, .065, 1.0, C('#6e7873'), MAT.metal, o);
    for (let i = 0; i < 9; i++) b.box(sx * .21, .185, -.61 + i * .12, .008, .06, .008, M.steelDark, MAT.metal, o);
  }
  b.box(0, .19, .62, .08, .08, .025, M.steelDark, MAT.metal, o);
  // stern transom / name board
  b.box(0, .11, -.744, .22, .1, .016, M.navyDeep, MAT.paint, o);
  b.box(0, .13, -.753, .16, .026, .008, M.cream, MAT.trim, o);
  // white accommodation block, aft
  b.box(0, .235, -.545, .34, .24, .25, M.cream, MAT.paint, o);
  b.box(0, .36, -.56, .35, .022, .26, M.white, MAT.paint, o);
  // bridge deck and wings
  b.box(0, .365, -.455, .46, .038, .15, M.cream, MAT.paint, o);
  b.box(0, .39, -.42, .32, .065, .08, M.white, MAT.paint, o);
  b.box(0, .39, -.376, .28, .038, .012, C('#2f4f58'), MAT.window, o);
  b.box(-.155, .39, -.455, .08, .038, .12, M.cream, MAT.paint, o);
  b.box(.155, .39, -.455, .08, .038, .12, M.cream, MAT.paint, o);
  // side windows on house
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) b.box(sx * .172, .25, -.61 + i * .08, .008, .03, .045, M.window, MAT.window, o);
  // funnel with yellow collar and dark cap
  b.box(0, .39, -.62, .1, .22, .1, M.navyDeep, MAT.paint, o);
  b.box(0, .45, -.62, .108, .026, .108, M.yellow, MAT.cream, o);
  b.box(0, .505, -.62, .11, .016, .11, M.charcoal, MAT.metal, o);
  b.box(0, .43, -.568, .04, .06, .008, M.cream, MAT.trim, o);
  // ship mast and radar mast
  b.cylinder(0, .45, .32, .008, .3, M.steelDark, MAT.metal, o, 6);
  b.box(0, .58, .32, .13, .008, .008, M.steelDark, MAT.metal, o);
  b.box(0, .625, .32, .05, .008, .015, M.yellow, MAT.emissive, o);
  b.cylinder(0, .50, -.55, .007, .23, M.steelDark, MAT.metal, o, 6);
  // deck cranes / lashing gear
  for (const z of [-.32, .25]) {
    b.box(-.17, .16, z, .045, .045, .08, M.steelDark, MAT.metal, o);
    b.box(.17, .16, z, .045, .045, .08, M.steelDark, MAT.metal, o);
  }
  // forecastle winch and bollards
  b.cylinder(0, .14, .52, .035, .06, M.steelDark, MAT.metal, o, 8);
  for (const sx of [-.09, .09]) b.cylinder(sx, .14, .57, .012, .06, M.charcoal, MAT.metal, o, 6);
  // anchor chain / hawse
  b.torus(.13, .115, .65, .025, .006, M.rust, MAT.rust, o, 10, 4, Q.axisAngle([1, 0, 0], 0));
  // anti-fouling lower hull hinted with a darker paint band at the waterline
  b.box(0, .026, -.04, .475, .012, 1.3, C('#3c4c4b'), MAT.paint, o);
  // prop and rudder
  b.box(0, -.07, -.755, .035, .17, .025, M.redDeep, MAT.paint, o);
  b.sphere(0, -.06, -.78, .045, .045, .02, M.brass, MAT.metal, o, 8, 5);
  // orange life rings on the house
  b.torus(-.12, .28, -.424, .032, .009, M.orange, MAT.paint, o, 12, 4, Q.axisAngle([1, 0, 0], 0));
  b.torus(.12, .28, -.424, .032, .009, M.orange, MAT.paint, o, 12, 4, Q.axisAngle([1, 0, 0], 0));
  // radar object geometry
  b.box(0, 0, 0, .13, .012, .02, M.cream, MAT.paint, OBJ.shipRadar);
  b.box(0, -.017, 0, .025, .03, .025, M.steelDark, MAT.metal, OBJ.shipRadar);
  // propeller object geometry, axis along z
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU;
    const dx = Math.cos(a) * .055, dy = Math.sin(a) * .055;
    b.beam([0, 0, 0], [dx, dy, 0], .028, .012, M.brass, MAT.metal, OBJ.shipProp);
  }
  b.cylinder(0, 0, 0, .012, .06, M.brass, MAT.metal, OBJ.shipProp, 7);
}

function buildTugGeometry(b) {
  const o = OBJ.tug;
  const sections = [
    { z: -.28, w: .085, y: .065, b: -.055 },
    { z: -.1, w: .115, y: .07, b: -.08 },
    { z: .12, w: .115, y: .075, b: -.075 },
    { z: .27, w: .035, y: .095, b: -.015 }
  ];
  loftHull(b, o, sections, C('#222b2b'), C('#33423e'), MAT.hull);
  b.box(0, .095, -.08, .19, .018, .38, C('#4e5e58'), MAT.metal, o);
  // white/red deckhouse
  b.box(0, .185, -.08, .18, .16, .19, M.cream, MAT.paint, o);
  b.box(0, .195, -.038, .14, .032, .012, M.window, MAT.window, o);
  for (const sx of [-1, 1]) b.box(sx * .091, .2, -.08, .008, .035, .1, M.window, MAT.window, o);
  b.box(0, .267, -.08, .19, .022, .2, M.red, MAT.paint, o);
  // red funnel and mast
  b.box(0, .31, -.13, .05, .11, .055, M.red, MAT.paint, o);
  b.box(0, .368, -.13, .054, .012, .058, M.charcoal, MAT.metal, o);
  b.cylinder(0, .27, .03, .006, .17, M.steelDark, MAT.metal, o, 5);
  b.box(0, .35, .03, .03, .008, .02, M.cream, MAT.trim, o);
  // big bow fender and tire belt
  b.sphere(0, .07, .285, .08, .07, .045, M.rubber, MAT.rubber, o, 10, 6);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    b.cylinder(sx * .116, .065 + i * .024, -.15 + i * .09, .027, .018, M.rubber, MAT.rubber, o, 8);
  }
  b.torus(0, .06, -.265, .05, .014, M.rubber, MAT.rubber, o, 12, 5, Q.axisAngle([1, 0, 0], 0));
  // winch at stern and towing hook
  b.cylinder(0, .12, -.22, .035, .05, M.steelDark, MAT.metal, o, 8);
  b.torus(0, .09, -.27, .022, .005, M.brass, MAT.metal, o, 10, 4, Q.axisAngle([0, 0, 1], 0));
  // propeller hint
  b.sphere(0, -.055, -.285, .04, .04, .02, M.brass, MAT.metal, o, 8, 5);
}

function buildSailboatGeometry(b, obj, hullHex, stripeHex, name) {
  const sections = [
    { z: -.3, w: .07, y: .045, b: -.035 },
    { z: -.12, w: .105, y: .05, b: -.06 },
    { z: .1, w: .1, y: .056, b: -.055 },
    { z: .28, w: .02, y: .068, b: -.01 }
  ];
  loftHull(b, obj, sections, C(hullHex), C('#b7aa91'), MAT.paint);
  b.box(0, .053, -.06, .17, .014, .32, C('#435b57'), MAT.wood, obj);
  // coloured sheer stripe
  for (const sx of [-1, 1]) b.box(sx * .1, .047, -.06, .008, .012, .36, C(stripeHex), MAT.paint, obj);
  // cockpit and seats
  b.box(0, .067, -.06, .11, .018, .13, C('#7c6b55'), MAT.wood, obj);
  b.box(0, .078, -.12, .04, .03, .028, M.woodDark, MAT.wood, obj);
  // mast, boom, furled sail
  b.cylinder(0, .36, .02, .006, .58, M.chrome, MAT.metal, obj, 6);
  b.box(0, .32, -.06, .012, .012, .26, M.chrome, MAT.metal, obj);
  b.cylinder(0, .29, -.06, .02, .3, C('#e7dec5'), MAT.paint, obj, 7);
  b.box(0, .28, .11, .01, .01, .22, M.chrome, MAT.metal, obj);
  // forestay and backstay as thin lines made from rods
  b.tube([0, .66, .02], [0, .06, .27], .0028, M.steelDark, MAT.metal, obj, 4);
  b.tube([0, .66, .02], [0, .06, -.28], .0028, M.steelDark, MAT.metal, obj, 4);
  // keel fin and rudder visible through the jelly
  b.box(0, -.16, -.02, .012, .23, .09, M.steelDark, MAT.metal, obj);
  b.box(0, -.12, -.28, .012, .18, .05, M.redDeep, MAT.paint, obj);
  b.sphere(0, .01, -.32, .03, .02, .04, M.rubber, MAT.rubber, obj, 8, 5);
  // tiny cabin hatch and fenders
  b.box(0, .083, .12, .08, .025, .09, M.cream, MAT.paint, obj);
  for (const sx of [-1, 1]) b.cylinder(sx * .105, .04, -.07, .018, .012, M.rubber, MAT.rubber, obj, 6);
}

function buildFishingBoatGeometry(b, obj, hullHex, cabinHex) {
  const sections = [
    { z: -.18, w: .06, y: .04, b: -.03 },
    { z: -.05, w: .09, y: .05, b: -.055 },
    { z: .1, w: .08, y: .062, b: -.05 },
    { z: .2, w: .012, y: .072, b: -.005 }
  ];
  loftHull(b, obj, sections, C(hullHex), C('#b8ae98'), MAT.paint);
  b.box(0, .08, -.02, .12, .07, .12, C(cabinHex), MAT.paint, obj);
  b.box(0, .087, .041, .1, .03, .01, M.window, MAT.window, obj);
  b.cylinder(0, .22, .03, .005, .28, M.steelDark, MAT.metal, obj, 5);
  b.box(0, .18, .03, .12, .006, .006, M.steelDark, MAT.metal, obj);
  b.cylinder(-.07, .12, -.12, .025, .03, M.rubber, MAT.rubber, obj, 6);
  for (const sx of [-1, 1]) b.cylinder(sx * .088, .045, 0, .016, .012, M.rubber, MAT.rubber, obj, 6);
  b.torus(0, .07, .17, .035, .01, M.rope, MAT.rope, obj, 10, 4, Q.axisAngle([1, 0, 0], 0));
}

function buildBuoyGeometry(b, obj, color, type) {
  if (type === 'green') {
    b.cylinder(0, .03, 0, .085, .08, C(color), MAT.paint, obj, 10);
    b.cylinder(0, .085, 0, .055, .05, C(color), MAT.paint, obj, 10);
    b.cylinder(0, .13, 0, .016, .12, M.steelDark, MAT.metal, obj, 6);
    b.sphere(0, .2, 0, .025, .025, .025, C('#f2d475'), MAT.emissive, obj, 7, 4);
    b.torus(0, .02, 0, .08, .012, M.steelDark, MAT.metal, obj, 12, 4, Q.axisAngle([1, 0, 0], 0));
  } else {
    b.sphere(0, .025, 0, .085, .07, .085, C(color), MAT.paint, obj, 12, 7);
    b.cylinder(0, .09, 0, .018, .07, M.steelDark, MAT.metal, obj, 6);
    b.sphere(0, .13, 0, .018, .018, .018, C('#fff1b8'), MAT.emissive, obj, 6, 4);
    b.torus(0, .006, 0, .07, .012, M.charcoal, MAT.metal, obj, 12, 4, Q.axisAngle([1, 0, 0], 0));
  }
}

function buildLifeRingGeometry(b) {
  b.torus(0, 0, 0, .115, .026, M.orange, MAT.paint, OBJ.lifeRing, 24, 7, Q.axisAngle([1, 0, 0], 0));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + PI / 4;
    const x = Math.cos(a) * .115, z = Math.sin(a) * .115;
    const tx = -Math.sin(a) * .036, tz = Math.cos(a) * .036;
    b.beam([x - tx, .021, z - tz], [x + tx, .021, z + tz], .018, .012, M.cream, MAT.paint, OBJ.lifeRing);
  }
  b.torus(0, 0, 0, .118, .004, C('#d9cfbc'), MAT.rope, OBJ.lifeRing, 24, 4, Q.axisAngle([1, 0, 0], 0));
}

function buildDynamicGeometry() {
  const b = new MeshBuilder();
  buildCraneGeometry(b, 0);
  buildCraneGeometry(b, 1);
  buildShipGeometry(b);
  buildTugGeometry(b);
  buildSailboatGeometry(b, OBJ.sailA, '#eee8d8', '#6d8f83', 'mimosa');
  buildSailboatGeometry(b, OBJ.sailB, '#f0e9da', '#b96d59', 'petrel');
  buildBuoyGeometry(b, OBJ.buoyY1, '#e4b641', 'yellow');
  buildBuoyGeometry(b, OBJ.buoyY2, '#e4b641', 'yellow');
  buildBuoyGeometry(b, OBJ.buoyG, '#3b8b62', 'green');
  buildFishingBoatGeometry(b, OBJ.fishing0, '#3d6377', '#e5dac3');
  buildFishingBoatGeometry(b, OBJ.fishing1, '#c9a15a', '#f1e8d5');
  buildLifeRingGeometry(b);
  return b;
}

function containerColorFor(index) {
  return CONTAINER_PAINTS[Math.abs(index) % CONTAINER_PAINTS.length];
}

function buildContainerPlan() {
  const yard = [];
  let seed = 0;
  const yardRows = [-2.42, -2.18, -1.94];
  const cols = 11;
  for (let r = 0; r < yardRows.length; r++) {
    for (let c = 0; c < cols; c++) {
      const z = -1.35 + c * .17;
      const layers = 4 + ((r * 5 + c * 3) % 3);
      for (let y = 0; y < layers; y++) {
        yard.push({
          x: yardRows[r] + ((c + y) % 2 ? .006 : -.004),
          y: .266 + .031 + y * .064,
          z: z + ((r + y) % 2 ? .004 : -.003),
          color: containerColorFor(r * 31 + c * 7 + y * 3),
          rot: ((r + c + y) % 5 === 0) ? .006 : 0,
          key: 'yard-' + r + '-' + c + '-' + y
        });
        seed++;
      }
    }
  }
  // a small foreground block for visual depth
  for (let r = 0; r < 3; r++) {
    for (let y = 0; y < 3; y++) {
      yard.push({ x: [-2.42, -2.18, -1.94][r], y: .266 + .031 + y * .064, z: .55 + (r % 2) * .012, color: containerColorFor(r * 7 + 3), rot: 0, key: 'front-' + r + '-' + y });
    }
  }
  const transferKeys = new Set(['0-1-1', '1-2-1', '4-1-1', '5-2-1']);
  const shipStatic = [];
  for (let bay = 0; bay < 6; bay++) {
    for (let row = 0; row < 4; row++) {
      for (let tier = 0; tier < 2; tier++) {
        if (transferKeys.has(bay + '-' + row + '-' + tier)) continue;
        shipStatic.push({
          bay, row, tier,
          color: containerColorFor(bay * 17 + row * 5 + tier * 11),
          key: 'ship-' + bay + '-' + row + '-' + tier
        });
      }
    }
  }
  return { yard, shipStatic };
}