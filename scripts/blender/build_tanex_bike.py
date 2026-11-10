# Builds the TanEx delivery bike + rider + top box in Blender and exports it as glTF
# (MOTION_3D_SPEC §4; design/3d-brief.md §4–§5). Realistic style (owner decision 2026-11-10).
# This is the in-house model the homepage uses until the commissioned one arrives (#117); it
# follows the brief's node names, pivots, scale and orientation exactly, so the two are
# interchangeable.
#
# Run (Blender 4.2 LTS or later, no UI):
#   blender --background --factory-startup --python scripts/blender/build_tanex_bike.py -- <out.glb> [<preview-prefix>]
# then compress for the web:
#   npx gltfpack -i <out.glb> -o Public/3d/tanex-bike.glb -cc -kn -km
#
# Units: metres. Bike space (x, up, fwd) maps to Blender (x, -fwd, up): the bike faces -Y in
# Blender, which the glTF exporter (+Y up) turns into +Z. Every pivot is an empty at its
# rotation axis with zero rotation and unit scale; geometry hangs under it.
import math
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_GLB = argv[0] if argv else 'tanex-bike-raw.glb'
PREVIEW = argv[1] if len(argv) > 1 else ''

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def P(x, up, fwd):
    """Bike space → Blender space."""
    return Vector((x, -fwd, up))


# ---------------------------------------------------------------- materials (brief §4.2)
def lin(hex_):
    h = hex_.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


def mat(name, hex_, rough=0.5, metal=0.0, coat=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(hex_)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.06
    if emit:
        b.inputs['Emission Color'].default_value = lin(hex_)
        b.inputs['Emission Strength'].default_value = emit
    return m


PAINT = mat('paint_body', '#2A1B16', 0.3, 0.0, coat=0.7)        # Chocolate 900, glossy paint
FAIRING = mat('paint_fairing', '#38241D', 0.3, 0.0, coat=0.7)   # Chocolate 800
FRAME = mat('frame', '#161110', 0.42, 0.25)
ENGINE = mat('engine', '#4A3128', 0.38, 0.65)                   # Chocolate 700, cast metal
ALU = mat('aluminium', '#C9C3BE', 0.28, 1.0)
CHROME = mat('chrome', '#EDEDED', 0.06, 1.0)
RIMS = mat('rims', '#BF9C8A', 0.3, 0.75)                        # Chocolate 300, alloy
TYRE = mat('tyre', '#141010', 0.88)
RUBBER = mat('rubber', '#1C120E', 0.8)
SEAT = mat('seat', '#1C120E', 0.5)
HEADLIGHT = mat('headlight', '#FFFCF7', 0.08, emit=6.0)         # Cream 50
TAIL = mat('tail_light', '#C4281C', 0.15, emit=3.0)
INDICATOR = mat('indicator', '#FFB55C', 0.15, emit=2.5)         # Orange 300
MIRROR = mat('mirror', '#DDE2E6', 0.02, 1.0)
DIAL = mat('dial', '#F5ECDB', 0.4, emit=0.4)
PLATE = mat('plate', '#FBF6EC', 0.6)
BOX = mat('top_box', '#F48800', 0.35, coat=0.35)                # Orange 500
MARK = mat('mark', '#1C120E', 0.5)                              # plane mark decal
REFLECTOR = mat('reflector', '#B3261E', 0.2, emit=0.4)
HELMET = mat('helmet', '#4A3128', 0.22, coat=0.9)               # Chocolate 700
VISOR = mat('visor', '#1C120E', 0.04, 0.5, coat=1.0)            # Chocolate 950
SPEED = mat('speed_lines', '#F48800', 0.4, emit=0.3)
VEST = mat('vest', '#38241D', 0.86)                             # Chocolate 800
BAND = mat('vest_band', '#EDDFC4', 0.7)                         # Cream 300
POLO = mat('polo', '#141010', 0.85)
TROUSERS = mat('trousers', '#1C120E', 0.88)
SHOES = mat('shoes', '#0F0A08', 0.55)
SKIN = mat('skin', '#6B4330', 0.5)
GLOVES = mat('gloves', '#1C120E', 0.7)
SCREEN = mat('screen', '#F5ECDB', 0.3, emit=0.8)                # brief §5.4: its own material


# ---------------------------------------------------------------- objects
WORLD = {}


def empty(name, parent, at):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.05
    col.objects.link(o)
    WORLD[name] = P(*at)
    o.location = WORLD[name] - (WORLD[parent.name] if parent else Vector())
    o.parent = parent
    return o


def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def finish(o, material, parent, bevel=0.0, segments=2, subsurf=0, angle=35, name=None):
    """Bakes the object's transform into its mesh (world coordinates), applies modifiers,
    assigns the material, smooths and hangs it under `parent` without moving it."""
    activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = segments
        m.limit_method = 'ANGLE'
    if subsurf:
        m = o.modifiers.new('subsurf', 'SUBSURF')
        m.levels = subsurf
        m.render_levels = subsurf
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.clear()
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    o.parent = parent
    o.location = -WORLD[parent.name]
    if name:
        o.name = name
    return o


def new_active():
    return bpy.context.active_object


def box(parent, center, size, material, rot=(0, 0, 0), bevel=0.01, segments=2, subsurf=0, name=None):
    """Rounded box. size = (width x, height up, length fwd); rot in degrees about (x, up, fwd)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = new_active()
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (math.radians(rot[0]), -math.radians(rot[2]), math.radians(rot[1]))
    o.location = P(*center)
    return finish(o, material, parent, bevel=bevel, segments=segments, subsurf=subsurf, name=name)


def ellipsoid(parent, center, radii, material, rot=(0, 0, 0), seg=28, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1)
    o = new_active()
    o.scale = (radii[0], radii[2], radii[1])
    o.rotation_euler = (math.radians(rot[0]), -math.radians(rot[2]), math.radians(rot[1]))
    o.location = P(*center)
    return finish(o, material, parent, angle=80)


def tube(parent, a, b, r, material, verts=14, cap_bevel=0.0):
    A, B = P(*a), P(*b)
    d = B - A
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length)
    o = new_active()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (A + B) / 2
    return finish(o, material, parent, bevel=cap_bevel, angle=50)


def path(parent, pts, r, material, verts=14):
    """A bent tube through points, with a ball at each joint so bends look continuous."""
    for a, b in zip(pts, pts[1:]):
        tube(parent, a, b, r, material, verts)
    for p in pts[1:-1]:
        ellipsoid(parent, p, (r, r, r), material, seg=verts, rings=8)


def disc(parent, center, r, depth, material, verts=32, bevel=0.0, axis='x', tilt=0.0):
    """A cylinder whose axis runs along bike x (default), fwd or up (tilted forward by `tilt`°)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth)
    o = new_active()
    if axis == 'x':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'fwd':
        o.rotation_euler = (math.radians(90), 0, 0)
    else:
        o.rotation_euler = (-math.radians(tilt), 0, 0)
    o.location = P(*center)
    return finish(o, material, parent, bevel=bevel, angle=40)


def ring(parent, center, major, minor, material, axis='x', majseg=48, minseg=12, squash=1.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=majseg, minor_segments=minseg)
    o = new_active()
    o.scale = (1, 1, squash)
    if axis == 'x':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'fwd':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.location = P(*center)
    return finish(o, material, parent, angle=80)


def arc_band(parent, center, radius, width, thick, a0, a1, material, steps=24):
    """A curved mudguard: a band around the bike-x axis, angles in degrees from fwd towards up."""
    bm = bmesh.new()
    rows = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        row = []
        for rr in (radius, radius + thick):
            for x in (-width / 2, width / 2):
                row.append(bm.verts.new(P(center[0] + x, center[1] + rr * math.sin(a), center[2] + rr * math.cos(a))))
        rows.append(row)
    for r0, r1 in zip(rows, rows[1:]):
        for i, j in ((0, 1), (1, 3), (3, 2), (2, 0)):
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    bm.faces.new((rows[0][0], rows[0][2], rows[0][3], rows[0][1]))
    bm.faces.new((rows[-1][0], rows[-1][1], rows[-1][3], rows[-1][2]))
    me = bpy.data.meshes.new('arc')
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('arc', me)
    col.objects.link(o)
    return finish(o, material, parent, bevel=0.004, angle=40)


def helix(parent, a, b, radius, turns, wire, material):
    """A coil spring between two points (curve with a round bevel, converted to a mesh)."""
    A, B = P(*a), P(*b)
    axis = (B - A)
    q = Vector((0, 0, 1)).rotation_difference(axis.normalized())
    cu = bpy.data.curves.new('spring', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = wire
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    steps = turns * 14
    sp.points.add(steps)
    for i in range(steps + 1):
        t = i / steps
        ang = 2 * math.pi * turns * t
        local = Vector((radius * math.cos(ang), radius * math.sin(ang), axis.length * t))
        p = A + q @ local
        sp.points[i].co = (p.x, p.y, p.z, 1)
    o = bpy.data.objects.new('spring', cu)
    col.objects.link(o)
    activate(o)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    return finish(o, material, parent, angle=60)


def skin_body(parent, pts, edges, radii, material):
    """Smooth limbs/torso from a skeleton (skin + subdivision modifiers)."""
    me = bpy.data.meshes.new('body')
    me.from_pydata([P(*p) for p in pts], edges, [])
    o = bpy.data.objects.new('body', me)
    col.objects.link(o)
    o.modifiers.new('skin', 'SKIN')
    sv = o.data.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = (r, r) if isinstance(r, (int, float)) else r
    sv[0].use_root = True
    sub = o.modifiers.new('subsurf', 'SUBSURF')
    sub.levels = 2
    activate(o)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return finish(o, material, parent, angle=89)


def decal(parent, center, size, side, material):
    """The TanEx paper-plane mark as a flat decal on a box face. side: 'left', 'right' or 'back'."""
    shape = [(-0.5, -0.12), (0.5, 0.22), (-0.18, 0.06), (-0.3, 0.3), (-0.36, 0.02)]
    verts = []
    for u, v in shape:
        if side == 'back':
            verts.append(P(center[0] - u * size, center[1] + v * size, center[2]))
        else:
            verts.append(P(center[0], center[1] + v * size, center[2] + u * size))
    me = bpy.data.meshes.new('mark')
    me.from_pydata(verts, [], [list(range(len(verts)))])
    o = bpy.data.objects.new('mark', me)
    col.objects.link(o)
    return finish(o, material, parent, angle=10)


# ---------------------------------------------------------------- the bike
bike = empty('tanex_bike', None, (0, 0, 0))
body = empty('bike_body', bike, (0, 0, 0))

REAR_AXLE = (0, 0.30, -0.62)
FRONT_AXLE = (0, 0.30, 0.645)
HEAD_TOP = (0, 1.0, 0.43)
HEAD_BOTTOM = (0, 0.80, 0.53)

# Frame
path(body, [HEAD_TOP, (0, 0.92, 0.25), (0, 0.80, -0.04)], 0.03, FRAME)
path(body, [HEAD_BOTTOM, (0, 0.52, 0.36), (0, 0.33, 0.20), (0, 0.32, -0.06), (0, 0.42, -0.12)], 0.027, FRAME)
for x in (-0.09, 0.09):
    path(body, [(x, 0.78, -0.04), (x, 0.81, -0.50), (x, 0.84, -0.82)], 0.016, FRAME)
    tube(body, (x, 0.44, -0.12), (x, 0.80, -0.52), 0.016, FRAME)
tube(body, HEAD_BOTTOM, HEAD_TOP, 0.04, FRAME)

# Tank, side covers, seat, grab rail
ellipsoid(body, (0, 0.87, 0.21), (0.165, 0.12, 0.27), PAINT, rot=(-8, 0, 0), seg=40, rings=20)
disc(body, (0, 0.985, 0.25), 0.032, 0.02, CHROME, axis='up', verts=24)
for x in (-0.12, 0.12):
    box(body, (x, 0.70, -0.20), (0.06, 0.16, 0.30), PAINT, bevel=0.025, segments=3)
box(body, (0, 0.835, -0.30), (0.26, 0.09, 0.66), SEAT, rot=(-2, 0, 0), bevel=0.04, segments=3, subsurf=1)
path(body, [(-0.12, 0.86, -0.42), (-0.13, 0.88, -0.66), (0, 0.885, -0.72), (0.13, 0.88, -0.66), (0.12, 0.86, -0.42)], 0.011, CHROME, verts=10)

# Engine: crankcase, side covers, finned barrel, head, carb, air filter
box(body, (0, 0.40, 0.04), (0.22, 0.22, 0.34), ENGINE, bevel=0.035, segments=3)
for x in (-0.115, 0.115):
    disc(body, (x, 0.40, 0.05), 0.105, 0.03, ALU, verts=36, bevel=0.008)
for i in range(8):
    t = i / 7
    disc(body, (0, 0.50 + 0.15 * t, 0.17 + 0.04 * t), 0.082, 0.009, ENGINE, verts=28, axis='up', tilt=15)
tube(body, (0, 0.49, 0.165), (0, 0.67, 0.215), 0.052, ALU, verts=20)
box(body, (0, 0.70, 0.22), (0.14, 0.07, 0.15), ENGINE, rot=(14, 0, 0), bevel=0.02)
disc(body, (0, 0.62, 0.06), 0.03, 0.08, ALU, verts=16, axis='fwd')
box(body, (-0.105, 0.62, -0.16), (0.08, 0.14, 0.16), FRAME, bevel=0.025)

# Exhaust: header and muffler (right side)
path(body, [(0.02, 0.64, 0.29), (0.06, 0.42, 0.34), (0.12, 0.30, 0.16), (0.15, 0.34, -0.14)], 0.021, CHROME, verts=16)
tube(body, (0.155, 0.355, -0.13), (0.175, 0.47, -0.60), 0.052, CHROME, verts=24, cap_bevel=0.012)
disc(body, (0.175, 0.47, -0.605), 0.03, 0.03, FRAME, verts=16, axis='fwd')
box(body, (0.215, 0.41, -0.33), (0.012, 0.07, 0.24), FRAME, rot=(-13, 0, 0), bevel=0.004)

# Swingarm, chain guard, sprocket, shocks
for x in (-0.10, 0.10):
    tube(body, (x, 0.40, -0.06), (x, 0.30, -0.62), 0.022, FRAME, verts=12)
box(body, (-0.115, 0.37, -0.33), (0.02, 0.06, 0.52), PAINT, rot=(-10, 0, 0), bevel=0.008)
disc(body, (-0.085, 0.30, -0.62), 0.095, 0.008, ALU, verts=36)
for x in (-0.115, 0.115):
    tube(body, (x, 0.33, -0.555), (x, 0.78, -0.47), 0.011, CHROME, verts=10)
    tube(body, (x, 0.62, -0.50), (x, 0.79, -0.47), 0.024, FRAME, verts=14)
    helix(body, (x, 0.36, -0.550), (x, 0.62, -0.500), 0.026, 9, 0.0055, CHROME)

# Footpegs, kickstand, levers
for x in (-1, 1):
    disc(body, (x * 0.17, 0.38, 0.03), 0.017, 0.10, RUBBER, verts=12)
    disc(body, (x * 0.17, 0.47, -0.34), 0.014, 0.08, RUBBER, verts=12)
tube(body, (-0.10, 0.33, -0.08), (-0.13, 0.31, -0.36), 0.012, FRAME, verts=8)

# Rear fender, rack, tail light, plate, rear indicators
arc_band(body, REAR_AXLE, 0.34, 0.13, 0.008, 70, 200, PAINT)
for x in (-0.15, 0.15):
    tube(body, (x, 0.875, -0.48), (x, 0.875, -0.92), 0.011, CHROME, verts=10)
for z in (-0.5, -0.64, -0.78, -0.92):
    tube(body, (-0.15, 0.875, z), (0.15, 0.875, z), 0.009, CHROME, verts=10)
box(body, (0, 0.80, -0.905), (0.11, 0.05, 0.045), TAIL, bevel=0.012, segments=3)
box(body, (0, 0.67, -0.93), (0.17, 0.10, 0.006), PLATE, rot=(-15, 0, 0), bevel=0.002)
for x in (-1, 1):
    tube(body, (x * 0.06, 0.79, -0.89), (x * 0.15, 0.79, -0.90), 0.006, FRAME, verts=8)
    ellipsoid(body, (x * 0.165, 0.79, -0.90), (0.03, 0.018, 0.018), INDICATOR, seg=16, rings=8)

# Phone holder clamp on the bars is under handlebar (below).

# ---------------------------------------------------------------- steering: handlebar pivot
bars = empty('handlebar', bike, (0, 0.92, 0.47))
for x in (-0.085, 0.085):
    tube(bars, (x, 1.02, 0.425), (x, 0.62, 0.537), 0.021, CHROME, verts=16)   # stanchions
    tube(bars, (x, 0.66, 0.526), (x, 0.30, 0.645), 0.029, ALU, verts=16)      # sliders
    ellipsoid(bars, (x, 0.30, 0.645), (0.032, 0.032, 0.032), ALU, seg=16, rings=8)
box(bars, (0, 1.02, 0.43), (0.24, 0.035, 0.07), ALU, bevel=0.012)            # top clamp
box(bars, (0, 0.83, 0.48), (0.24, 0.04, 0.07), ALU, bevel=0.012)             # bottom clamp
for x in (-1, 1):
    path(bars, [(0, 1.06, 0.43), (x * 0.14, 1.07, 0.43), (x * 0.24, 1.10, 0.39), (x * 0.36, 1.10, 0.35)], 0.011, FRAME, verts=12)
    disc(bars, (x * 0.33, 1.10, 0.36), 0.018, 0.11, RUBBER, verts=14)
    box(bars, (x * 0.27, 1.09, 0.41), (0.13, 0.01, 0.02), ALU, rot=(0, x * -12, 0), bevel=0.003)
    tube(bars, (x * 0.22, 1.10, 0.40), (x * 0.29, 1.30, 0.37), 0.007, CHROME, verts=8)
    ellipsoid(bars, (x * 0.30, 1.33, 0.37), (0.055, 0.04, 0.012), FRAME, seg=20, rings=10)
    ellipsoid(bars, (x * 0.30, 1.33, 0.358), (0.048, 0.034, 0.004), MIRROR, seg=20, rings=10)
    tube(bars, (x * 0.07, 0.93, 0.585), (x * 0.16, 0.93, 0.6), 0.006, FRAME, verts=8)
    ellipsoid(bars, (x * 0.175, 0.93, 0.6), (0.03, 0.018, 0.018), INDICATOR, seg=16, rings=8)
# Headlight: shell, chrome rim, lens; speedometer
disc(bars, (0, 0.93, 0.6), 0.088, 0.11, PAINT, verts=32, bevel=0.02, axis='fwd')
ring(bars, (0, 0.93, 0.656), 0.083, 0.008, CHROME, axis='fwd', majseg=40, minseg=8)
ellipsoid(bars, (0, 0.93, 0.656), (0.078, 0.078, 0.022), HEADLIGHT, seg=32, rings=12)
disc(bars, (0, 1.065, 0.47), 0.05, 0.045, FRAME, verts=24, bevel=0.01, axis='fwd')
ellipsoid(bars, (0, 1.07, 0.448), (0.042, 0.042, 0.004), DIAL, seg=24, rings=8)
# Front fender and wheel
arc_band(bars, FRONT_AXLE, 0.34, 0.11, 0.007, 25, 140, PAINT)

phone = empty('phone_holder', bars, (0, 1.13, 0.43))
tube(phone, (0, 1.07, 0.43), (0, 1.12, 0.43), 0.008, FRAME, verts=8)
box(phone, (0, 1.16, 0.43), (0.085, 0.155, 0.012), RUBBER, rot=(28, 0, 0), bevel=0.006)
box(phone, (0, 1.162, 0.423), (0.072, 0.135, 0.002), SCREEN, rot=(28, 0, 0), bevel=0.0, name='phone_screen')


# ---------------------------------------------------------------- wheels
def wheel(name, parent, at):
    w = empty(name, parent, at)
    x0, y0, z0 = at
    ring(w, at, 0.245, 0.058, TYRE, axis='x', majseg=56, minseg=14, squash=0.82)
    ring(w, at, 0.196, 0.016, RIMS, axis='x', majseg=48, minseg=8)
    disc(w, at, 0.078, 0.12, ALU, verts=28, bevel=0.01)
    disc(w, at, 0.02, 0.17, CHROME, verts=12)
    n = 32
    for i in range(n):
        a = 2 * math.pi * i / n
        side = 0.045 if i % 2 else -0.045
        hub = (x0 + side, y0 + 0.07 * math.sin(a + 0.25), z0 + 0.07 * math.cos(a + 0.25))
        rim = (x0 + side * 0.15, y0 + 0.19 * math.sin(a), z0 + 0.19 * math.cos(a))
        tube(w, hub, rim, 0.0028, CHROME, verts=5)
    return w


wheel('front_wheel', bars, FRONT_AXLE)
wheel('rear_wheel', bike, REAR_AXLE)

# ---------------------------------------------------------------- top box
top = empty('top_box', bike, (0, 0.885, -0.70))
box(top, (0, 1.06, -0.70), (0.45, 0.35, 0.40), BOX, bevel=0.035, segments=4)
box(top, (0, 1.237, -0.70), (0.40, 0.004, 0.35), VISOR, bevel=0.0)
decal(top, (0.2265, 1.06, -0.70), 0.17, 'right', MARK)
decal(top, (-0.2265, 1.06, -0.70), 0.17, 'left', MARK)
decal(top, (0, 1.06, -0.9015), 0.17, 'back', MARK)
box(top, (0, 0.94, -0.902), (0.16, 0.025, 0.004), REFLECTOR, bevel=0.0)
lid = empty('box_lid', top, (0, 1.235, -0.90))
box(lid, (0, 1.262, -0.698), (0.46, 0.055, 0.41), BOX, bevel=0.03, segments=4)
box(lid, (0, 1.24, -0.893), (0.05, 0.03, 0.02), CHROME, bevel=0.005)
socket = empty('parcel_socket', top, (0, 0.905, -0.70))

# ---------------------------------------------------------------- rider
# Seated adult ≈ 1.75 m, upright commuter posture: hips on the seat, hands on the grips, feet on the pegs.
rider = empty('rider', bike, (0, 0.90, -0.24))
skin_body(rider,
          [(0, 0.95, -0.27), (-0.11, 0.92, -0.23), (-0.175, 0.83, 0.12), (-0.18, 0.49, 0.05),
           (0.11, 0.92, -0.23), (0.175, 0.83, 0.12), (0.18, 0.49, 0.05)],
          [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
          [(0.17, 0.12), (0.095, 0.095), (0.068, 0.068), (0.05, 0.05), (0.095, 0.095), (0.068, 0.068), (0.05, 0.05)],
          TROUSERS)
for x in (-0.18, 0.18):
    box(rider, (x, 0.43, 0.10), (0.105, 0.09, 0.27), SHOES, bevel=0.035, segments=3, subsurf=1)

HEAD = (0, 1.575, -0.125)
torso = empty('rider_torso', rider, (0, 0.95, -0.22))
# One torso that branches into both shoulders, so the arms join it smoothly (vest over a polo).
skin_body(torso,
          [(0, 0.99, -0.25), (0, 1.17, -0.22), (0, 1.33, -0.19), (-0.17, 1.355, -0.185), (0.17, 1.355, -0.185)],
          [(0, 1), (1, 2), (2, 3), (2, 4)],
          [(0.165, 0.125), (0.195, 0.14), (0.175, 0.125), (0.068, 0.066), (0.068, 0.066)],
          VEST)
ring(torso, (0, 1.02, -0.248), 0.166, 0.015, BAND, axis='up', majseg=44, minseg=8, squash=1.0)
for x in (-1, 1):
    # Short polo sleeve, bare forearm, glove on the grip; elbows slightly out and bent.
    skin_body(torso, [(x * 0.175, 1.355, -0.185), (x * 0.215, 1.30, -0.14), (x * 0.24, 1.235, -0.085)], [(0, 1), (1, 2)],
              [0.064, 0.062, 0.056], POLO)
    skin_body(torso, [(x * 0.238, 1.24, -0.09), (x * 0.26, 1.18, 0.03), (x * 0.305, 1.11, 0.31)], [(0, 1), (1, 2)],
              [0.05, 0.047, 0.036], SKIN)
    ellipsoid(torso, (x * 0.325, 1.10, 0.355), (0.05, 0.045, 0.07), GLOVES, seg=18, rings=10)
skin_body(torso, [(0, 1.38, -0.18), (0, 1.47, -0.15)], [(0, 1)], [0.058, 0.055], SKIN)
# Full-face helmet: an egg shape longer front to back, a chin bar and a visor band.
ellipsoid(torso, HEAD, (0.138, 0.15, 0.165), HELMET, seg=40, rings=20)
ellipsoid(torso, (0, HEAD[1] - 0.085, HEAD[2] + 0.075), (0.105, 0.06, 0.085), HELMET, seg=28, rings=12)


def visor(parent):
    """The front of the helmet as a separate glossy shell (no face is modelled: visor down)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1)
    o = new_active()
    o.scale = (0.142, 0.17, 0.154)
    o.location = P(*HEAD)
    activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    c = P(*HEAD)
    keep = lambda v: (c.y - v.co.y) > 0.045 and -0.045 < (v.co.z - c.z) < 0.06 and abs(v.co.x - c.x) < 0.125
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v)], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, VISOR, parent, angle=89)


visor(torso)
for x in (-1, 1):
    for i, length in enumerate((0.09, 0.07, 0.045)):
        box(torso, (x * 0.139, HEAD[1] + 0.035 - i * 0.026, HEAD[2] - 0.03 - length / 2 + 0.045), (0.006, 0.012, length), SPEED, bevel=0.0)


# ---------------------------------------------------------------- tidy: one mesh per pivot per material
def merge_children():
    pivots = [o for o in bpy.data.objects if o.type == 'EMPTY']
    for p in pivots:
        groups = {}
        for c in p.children:
            if c.type != 'MESH' or c.name == 'phone_screen':
                continue
            groups.setdefault(c.data.materials[0].name, []).append(c)
        for mname, objs in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            if len(objs) > 1:
                bpy.ops.object.join()
            merged = bpy.context.view_layer.objects.active
            merged.name = f'{p.name}__{mname}'
            merged.data.name = merged.name


merge_children()

tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print(f'TANEX_BIKE triangles={tris} meshes={sum(1 for o in bpy.data.objects if o.type == "MESH")} materials={len(bpy.data.materials)}')

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_texcoords=False, export_normals=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, use_selection=False,
)
print('TANEX_BIKE exported', OUT_GLB)


# ---------------------------------------------------------------- preview renders (not exported)
def preview(prefix):
    world = bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = lin('#F5ECDB')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    for name, rot, energy in (('key', (50, 0, 35), 3.5), ('rim', (60, 0, 200), 2.0)):
        light = bpy.data.lights.new(name, 'SUN')
        light.energy = energy
        lo = bpy.data.objects.new(name, light)
        lo.rotation_euler = tuple(math.radians(a) for a in rot)
        col.objects.link(lo)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 60
    col.objects.link(cam)
    scene.camera = cam
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if scene.render.engine == 'CYCLES':
        scene.cycles.samples = 48
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 800
    scene.render.film_transparent = False
    target = P(0, 0.78, 0)
    for label, az, el, dist in (('side', 0, 6, 5.2), ('three-quarter', 40, 14, 5.2), ('rear', -120, 22, 5.2)):
        a, e = math.radians(az), math.radians(el)
        pos = P(dist * math.cos(e) * math.cos(a), 0.78 + dist * math.sin(e), dist * math.cos(e) * math.sin(a))
        cam.location = pos
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = (target - pos).to_track_quat('-Z', 'Y')
        scene.render.filepath = f'{prefix}-{label}.png'
        bpy.ops.render.render(write_still=True)
        print('TANEX_BIKE preview', scene.render.filepath)


if PREVIEW:
    preview(PREVIEW)
