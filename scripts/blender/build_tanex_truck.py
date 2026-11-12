# Builds the TanEx box truck in Blender and exports it as glTF (MOTION_3D_SPEC §4;
# design/3d-brief.md §4.3, §6). Realistic style (owner decision 2026-11-10), same pipeline as
# build_tanex_bike.py. This is the in-house model the homepage uses until the commissioned one
# arrives (#117); it follows the brief's node names, pivots, scale and orientation exactly, so the
# two are interchangeable.
#
# Run (Blender 4.2 LTS or later, no UI):
#   blender --background --factory-startup --python scripts/blender/build_tanex_truck.py -- <out.glb> [<preview-prefix>]
# then compress for the web:
#   npx gltfpack -i <out.glb> -o Public/3d/tanex-truck.glb -cc -kn -km
#
# The TanEx wordmark on both sides of the cargo box is not modelled: the website places the logo
# file itself there (never redrawn), so the model carries no text and no texture.
#
# Units: metres. Truck space (x, up, fwd) maps to Blender (x, -fwd, up): the truck faces -Y in
# Blender, which the glTF exporter (+Y up) turns into +Z. Origin on the ground at the centre of
# the wheelbase. Every pivot is an empty at its rotation axis with zero rotation and unit scale.
import math
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_GLB = argv[0] if argv else 'tanex-truck-raw.glb'
PREVIEW = argv[1] if len(argv) > 1 else ''

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection


def P(x, up, fwd):
    """Truck space → Blender space."""
    return Vector((x, -fwd, up))


# ---------------------------------------------------------------- materials (brief §4.3), ≤ 12
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


CAB = mat('truck_cab', '#2A1B16', 0.3, 0.0, coat=0.7)          # Chocolate 900, glossy paint
# Satin rather than glossy: a strong clear coat mirrored the neutral studio environment and
# turned the cream box grey on the page.
BODY = mat('truck_box', '#FFFCF7', 0.55, 0.0, coat=0.1)         # Cream 50, painted panels
EDGE = mat('truck_edge', '#D9C2B5', 0.4, 0.35)                  # Chocolate 200, rails and panel lines
GLASS = mat('truck_glass', '#D9C2B5', 0.04, 0.55, coat=1.0)     # Chocolate 200, light tint, reflective
STRIPE = mat('truck_stripe', '#F48800', 0.35, 0.0, coat=0.35)   # Orange 500
TYRE = mat('truck_tyre', '#1C120E', 0.88)                       # Chocolate 950
RIMS = mat('truck_rims', '#BF9C8A', 0.3, 0.75)                  # Chocolate 300, alloy
TRIM = mat('truck_trim', '#161110', 0.5, 0.2)                   # bumpers, chassis, seals
CHROME = mat('truck_chrome', '#C9C3BE', 0.18, 1.0)              # handles, rods, mirror arms
LAMP = mat('truck_headlight', '#FFFCF7', 0.08, emit=6.0)        # Cream 50
TAIL = mat('truck_tail_light', '#C4281C', 0.15, emit=3.0)       # same red as the bike's tail light
INDICATOR = mat('truck_indicator', '#FFB55C', 0.15, emit=2.5)   # Orange 300


# ---------------------------------------------------------------- objects
WORLD = {}


def empty(name, parent, at):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.1
    col.objects.link(o)
    WORLD[name] = P(*at)
    o.location = WORLD[name] - (WORLD[parent.name] if parent else Vector())
    o.parent = parent
    return o


def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def finish(o, material, parent, bevel=0.0, segments=2, angle=35):
    """Bakes the transform into the mesh (world coordinates), applies modifiers, assigns the
    material, smooths and hangs it under `parent` without moving it."""
    activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = segments
        m.limit_method = 'ANGLE'
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.materials.clear()
    o.data.materials.append(material)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    o.parent = parent
    o.location = -WORLD[parent.name]
    return o


def new_active():
    return bpy.context.active_object


def box(parent, center, size, material, rot=(0, 0, 0), bevel=0.01, segments=2):
    """Rounded box. size = (width x, height up, length fwd); rot in degrees about (x, up, fwd)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = new_active()
    o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (math.radians(rot[0]), -math.radians(rot[2]), math.radians(rot[1]))
    o.location = P(*center)
    return finish(o, material, parent, bevel=bevel, segments=segments)


def tube(parent, a, b, r, material, verts=12):
    A, B = P(*a), P(*b)
    d = B - A
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length)
    o = new_active()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.location = (A + B) / 2
    return finish(o, material, parent, angle=50)


def disc(parent, center, r, depth, material, verts=32, bevel=0.0, axis='x'):
    """A cylinder whose axis runs along truck x (default), fwd or up."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth)
    o = new_active()
    if axis == 'x':
        o.rotation_euler = (0, math.radians(90), 0)
    elif axis == 'fwd':
        o.rotation_euler = (math.radians(90), 0, 0)
    o.location = P(*center)
    return finish(o, material, parent, bevel=bevel, angle=40)


def ring(parent, center, major, minor, material, majseg=40, minseg=12, squash=1.0):
    """A torus around truck x (a tyre), squashed along x."""
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=majseg, minor_segments=minseg)
    o = new_active()
    o.scale = (1, 1, squash)
    o.rotation_euler = (0, math.radians(90), 0)
    o.location = P(*center)
    return finish(o, material, parent, angle=80)


def prism(parent, profile, x0, x1, material, bevel=0.02, segments=3, angle=35):
    """A side profile [(fwd, up), ...] (counter-clockwise seen from +x) extruded from x0 to x1."""
    bm = bmesh.new()
    left = [bm.verts.new(P(x0, u, f)) for f, u in profile]
    right = [bm.verts.new(P(x1, u, f)) for f, u in profile]
    n = len(profile)
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('prism')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('prism', me)
    col.objects.link(o)
    return finish(o, material, parent, bevel=bevel, segments=segments, angle=angle)


def arch(parent, center, radius, width, thick, material, a0=-10, a1=190, steps=20):
    """A wheel arch: a band around the truck-x axis, angles in degrees from fwd towards up."""
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('arch')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('arch', me)
    col.objects.link(o)
    return finish(o, material, parent, bevel=0.006, angle=40)


# ---------------------------------------------------------------- dimensions (brief §6)
# ≈ 6.0 m long × 2.1 m wide × 3.1 m high; 3.5 t class, single front axle, twin rear wheels.
AXLE_Y = 0.37
FRONT_AXLE = 1.7
REAR_AXLE = -1.7
BOX_REAR = -3.05      # rear face of the cargo box
BOX_FRONT = 1.02
BOX_W = 2.1
BOX_BOTTOM = 0.86
BOX_TOP = 3.1
CAB_REAR = 1.1
CAB_FRONT = 2.95
CAB_W = 2.0
WALL = 0.05           # cargo box wall thickness

truck = empty('tanex_truck', None, (0, 0, 0))
body = empty('truck_body', truck, (0, 0, 0))

# ---------------------------------------------------------------- chassis
for x in (-0.46, 0.46):
    box(body, (x, 0.64, -0.2), (0.09, 0.2, 5.6), TRIM, bevel=0.01)
for f in (-2.6, -1.1, 0.4, 1.6):
    box(body, (0, 0.64, f), (0.92, 0.12, 0.08), TRIM, bevel=0.01)
# Fuel tank (left), battery box (right), side underride rails between the axles
disc(body, (-0.72, 0.62, 0.15), 0.21, 0.6, CHROME, verts=24, bevel=0.02, axis='fwd')
for f in (-0.08, 0.38):
    box(body, (-0.72, 0.62, f), (0.45, 0.04, 0.04), TRIM, bevel=0.005)
box(body, (0.72, 0.6, 0.2), (0.36, 0.3, 0.5), TRIM, bevel=0.02)
for x in (-1.0, 1.0):
    for y in (0.5, 0.68):
        box(body, (x, y, -0.62), (0.04, 0.06, 1.7), EDGE, bevel=0.008)
# Rear bumper (underride bar), tail lights, plate, reflectors
box(body, (0, 0.5, BOX_REAR + 0.06), (1.9, 0.14, 0.12), TRIM, bevel=0.02)
for x in (-0.82, 0.82):
    box(body, (x, 0.64, BOX_REAR + 0.14), (0.26, 0.13, 0.06), TRIM, bevel=0.01)
    box(body, (x - 0.045, 0.64, BOX_REAR + 0.105), (0.09, 0.1, 0.02), TAIL, bevel=0.004)
    box(body, (x + 0.06, 0.64, BOX_REAR + 0.105), (0.07, 0.1, 0.02), INDICATOR, bevel=0.004)
box(body, (0, 0.66, BOX_REAR + 0.12), (0.52, 0.12, 0.012), BODY, bevel=0.003)

# ---------------------------------------------------------------- cargo box: a shell open at the rear
cb = (BOX_REAR + BOX_FRONT) / 2
length = BOX_FRONT - BOX_REAR
height = BOX_TOP - BOX_BOTTOM
for x in (-1, 1):
    box(body, (x * (BOX_W / 2 - WALL / 2), BOX_BOTTOM + height / 2, cb), (WALL, height, length), BODY, bevel=0.02)
box(body, (0, BOX_TOP - WALL / 2, cb), (BOX_W, WALL, length), BODY, bevel=0.02)
box(body, (0, BOX_BOTTOM + 0.04, cb), (BOX_W, 0.08, length), EDGE, bevel=0.01)          # floor
box(body, (0, BOX_BOTTOM + height / 2, BOX_FRONT - WALL / 2), (BOX_W, height, WALL), BODY, bevel=0.02)
# Corner posts and roof/floor rails (Chocolate 200 edges)
for x in (-1, 1):
    for f in (BOX_REAR + 0.04, BOX_FRONT - 0.04):
        box(body, (x * (BOX_W / 2 - 0.01), BOX_BOTTOM + height / 2, f), (0.08, height + 0.02, 0.08), EDGE, bevel=0.015)
    for y in (BOX_BOTTOM + 0.03, BOX_TOP - 0.03):
        box(body, (x * (BOX_W / 2 + 0.005), y, cb), (0.05, 0.07, length), EDGE, bevel=0.012)
    # Panel lines on the sides
    for i in range(1, 5):
        f = BOX_REAR + length * i / 5
        box(body, (x * (BOX_W / 2 + 0.003), BOX_BOTTOM + height / 2, f), (0.012, height - 0.1, 0.03), EDGE, bevel=0.004)
    # The orange stripe along the box, above the floor rail
    box(body, (x * (BOX_W / 2 + 0.006), BOX_BOTTOM + 0.3, cb), (0.012, 0.16, length - 0.12), STRIPE, bevel=0.004)
# Rear frame around the door opening
box(body, (0, BOX_TOP - 0.06, BOX_REAR + 0.02), (BOX_W, 0.12, 0.06), EDGE, bevel=0.012)
box(body, (0, BOX_BOTTOM + 0.05, BOX_REAR + 0.02), (BOX_W, 0.1, 0.06), EDGE, bevel=0.012)
# Inside: two tie-down rails along the walls
for x in (-1, 1):
    box(body, (x * (BOX_W / 2 - WALL - 0.01), 1.5, cb), (0.02, 0.05, length - 0.2), EDGE, bevel=0.004)
# Roof marker lights
for x in (-0.8, 0.8):
    box(body, (x, BOX_TOP + 0.015, BOX_FRONT - 0.08), (0.12, 0.03, 0.05), INDICATOR, bevel=0.008)

# ---------------------------------------------------------------- cab
# The cab's floor line is below the tyre tops, so a wheel-arch opening is cut into the profile
# around the front axle (radius ARCH_R); extruding it gives the wheel well's roof as well.
ARCH_R = 0.47
CAB_FLOOR = 0.62
_t0 = math.asin((CAB_FLOOR - AXLE_Y) / ARCH_R)
_arch = [
    (FRONT_AXLE - ARCH_R * math.cos(t), AXLE_Y + ARCH_R * math.sin(t))
    for t in (_t0 + (math.pi - 2 * _t0) * i / 14 for i in range(15))
]
cab_profile = [
    (CAB_REAR, CAB_FLOOR), *_arch, (CAB_FRONT - 0.04, CAB_FLOOR), (CAB_FRONT, 0.8), (CAB_FRONT, 1.32),
    (CAB_FRONT - 0.1, 1.52), (CAB_FRONT - 0.48, 2.42), (CAB_FRONT - 0.72, 2.58), (CAB_REAR, 2.58),
]
prism(body, cab_profile, -CAB_W / 2, CAB_W / 2, CAB, bevel=0.06, segments=4)
# Windscreen: a glass panel just proud of the sloped front, with a dark seal
ws_bottom = (CAB_FRONT - 0.13, 1.58)
ws_top = (CAB_FRONT - 0.47, 2.36)
slope = math.degrees(math.atan2(ws_top[0] - ws_bottom[0], ws_top[1] - ws_bottom[1]))
mid = ((ws_bottom[0] + ws_top[0]) / 2, (ws_bottom[1] + ws_top[1]) / 2)
span_ = math.hypot(ws_top[0] - ws_bottom[0], ws_top[1] - ws_bottom[1])
nx, nu = math.cos(math.radians(slope)), math.sin(math.radians(slope))
box(body, (0, mid[1] + 0.012 * nu, mid[0] + 0.012 * nx), (1.86, span_ + 0.08, 0.02), TRIM, rot=(slope, 0, 0), bevel=0.01)
box(body, (0, mid[1] + 0.022 * nu, mid[0] + 0.022 * nx), (1.78, span_, 0.012), GLASS, rot=(slope, 0, 0), bevel=0.004)
# Wipers, parked along the bottom of the windscreen
along = (ws_top[0] - ws_bottom[0]) / span_, (ws_top[1] - ws_bottom[1]) / span_
for x in (-0.42, 0.42):
    wf = ws_bottom[0] + 0.07 * along[0] + 0.036 * nx
    wu = ws_bottom[1] + 0.07 * along[1] + 0.036 * nu
    box(body, (x, wu, wf), (0.72, 0.018, 0.014), TRIM, rot=(slope, 0, 0), bevel=0.004)
    tube(body, (x + 0.33, wu - 0.03 * along[1], wf - 0.03 * along[0]), (x + 0.33, wu, wf), 0.012, TRIM, verts=8)
# Side windows on the doors, door seams, handles, steps
for x in (-1, 1):
    sx = x * (CAB_W / 2 + 0.006)
    win = [(CAB_REAR + 0.95, 1.62), (CAB_FRONT - 0.2, 1.62), (CAB_FRONT - 0.55, 2.38), (CAB_REAR + 0.95, 2.38)]
    prism(body, win, sx - 0.006, sx + 0.006, GLASS, bevel=0.0)
    prism(body, [(CAB_REAR + 0.22, 1.66), (CAB_REAR + 0.86, 1.66), (CAB_REAR + 0.86, 2.36), (CAB_REAR + 0.22, 2.36)],
          sx - 0.006, sx + 0.006, GLASS, bevel=0.0)
    box(body, (sx, 1.55, CAB_REAR + 0.9), (0.014, 1.75, 0.02), TRIM, bevel=0.0)
    box(body, (sx, 1.55, CAB_FRONT - 0.12), (0.014, 1.75, 0.02), TRIM, bevel=0.0)
    box(body, (x * (CAB_W / 2 + 0.025), 1.45, CAB_REAR + 1.05), (0.03, 0.04, 0.2), CHROME, bevel=0.01)
    box(body, (x * (CAB_W / 2 - 0.1), 0.42, CAB_REAR + 1.3), (0.3, 0.04, 0.5), TRIM, bevel=0.01)
    # The stripe continues along the cab, at the box stripe's height line
    box(body, (x * (CAB_W / 2 + 0.008), 1.16, (CAB_REAR + CAB_FRONT) / 2 - 0.05), (0.012, 0.11, CAB_FRONT - CAB_REAR - 0.25), STRIPE, bevel=0.004)
    # Mirror: arm and housing
    tube(body, (x * (CAB_W / 2), 2.05, CAB_FRONT - 0.42), (x * (CAB_W / 2 + 0.24), 2.0, CAB_FRONT - 0.42), 0.014, CHROME, verts=8)
    box(body, (x * (CAB_W / 2 + 0.28), 1.88, CAB_FRONT - 0.42), (0.1, 0.36, 0.08), TRIM, bevel=0.02)
# Front: bumper, grille, headlights, indicators, plate
box(body, (0, 0.6, CAB_FRONT + 0.06), (2.04, 0.24, 0.16), TRIM, bevel=0.03, segments=3)
box(body, (0, 1.05, CAB_FRONT + 0.012), (1.1, 0.42, 0.02), TRIM, bevel=0.01)
for i in range(5):
    box(body, (0, 0.89 + i * 0.08, CAB_FRONT + 0.026), (1.04, 0.025, 0.012), EDGE, bevel=0.0)
for x in (-0.76, 0.76):
    box(body, (x, 1.06, CAB_FRONT + 0.015), (0.34, 0.2, 0.03), TRIM, bevel=0.02)
    box(body, (x, 1.06, CAB_FRONT + 0.028), (0.3, 0.16, 0.012), LAMP, bevel=0.01)
    box(body, (x * 1.14, 1.06, CAB_FRONT - 0.04), (0.06, 0.12, 0.1), INDICATOR, bevel=0.01)
box(body, (0, 0.62, CAB_FRONT + 0.145), (0.52, 0.12, 0.012), BODY, bevel=0.003)
# Wheel arches
_a0 = math.degrees(_t0) - 8
for x in (-1, 1):
    # Black flare around each front wheel opening, just proud of the cab side
    arch(body, (x * (CAB_W / 2 - 0.08), AXLE_Y, FRONT_AXLE), ARCH_R, 0.2, 0.045, TRIM, a0=_a0, a1=180 - _a0)
    box(body, (x * 0.88, AXLE_Y + 0.46, REAR_AXLE), (0.36, 0.04, 1.0), TRIM, bevel=0.01)   # rear mudguards
    box(body, (x * 0.88, 0.48, REAR_AXLE - 0.52), (0.36, 0.42, 0.02), TRIM, bevel=0.004)   # mud flaps

# ---------------------------------------------------------------- cargo door (one wide door, hinged on the right)
HINGE_X = BOX_W / 2 - 0.02
door = empty('cargo_door', truck, (HINGE_X, 0, BOX_REAR))
dw = BOX_W - 0.08
dh = height - 0.2
dy = BOX_BOTTOM + 0.1 + dh / 2
dx = HINGE_X - dw / 2 - 0.02
box(door, (dx, dy, BOX_REAR - 0.02), (dw, dh, 0.04), BODY, bevel=0.012)
for f in (0.25, 0.5, 0.75):
    box(door, (dx, BOX_BOTTOM + 0.1 + dh * f, BOX_REAR - 0.043), (dw - 0.08, 0.02, 0.008), EDGE, bevel=0.0)
for x in (dx - dw * 0.3, dx + dw * 0.18):
    tube(door, (x, BOX_BOTTOM + 0.16, BOX_REAR - 0.07), (x, BOX_TOP - 0.16, BOX_REAR - 0.07), 0.016, CHROME, verts=10)
    for y in (BOX_BOTTOM + 0.2, BOX_TOP - 0.2):
        box(door, (x, y, BOX_REAR - 0.055), (0.07, 0.05, 0.03), CHROME, bevel=0.006)
    box(door, (x - 0.08, 1.4, BOX_REAR - 0.075), (0.16, 0.035, 0.03), CHROME, bevel=0.008)
for y in (BOX_BOTTOM + 0.35, 1.95, BOX_TOP - 0.35):
    box(door, (HINGE_X - 0.02, y, BOX_REAR - 0.05), (0.06, 0.12, 0.05), CHROME, bevel=0.008)
box(door, (dx, 1.0, BOX_REAR - 0.045), (0.6, 0.06, 0.008), TAIL, bevel=0.0)                # reflector strip


# ---------------------------------------------------------------- wheels (twin rears as one node)
def tyre(parent, x, z):
    ring(parent, (x, AXLE_Y, z), 0.29, 0.1, TYRE, majseg=40, minseg=12, squash=1.2)
    disc(parent, (x, AXLE_Y, z), 0.235, 0.2, TYRE, verts=32)


def wheel(name, x, z, twin):
    w = empty(name, truck, (x, AXLE_Y, z))
    side = 1 if x > 0 else -1
    outer = x
    tyre(w, outer, z)
    if twin:
        tyre(w, outer - side * 0.25, z)
    face = outer + side * 0.1
    disc(w, (face - side * 0.02, AXLE_Y, z), 0.21, 0.04, RIMS, verts=32, bevel=0.01)
    disc(w, (face, AXLE_Y, z), 0.09, 0.05, CHROME, verts=20, bevel=0.01)
    for i in range(6):
        a = 2 * math.pi * i / 6
        disc(w, (face + side * 0.02, AXLE_Y + 0.13 * math.sin(a), z + 0.13 * math.cos(a)), 0.016, 0.03, CHROME, verts=6)
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        disc(w, (face - side * 0.005, AXLE_Y + 0.17 * math.sin(a), z + 0.17 * math.cos(a)), 0.022, 0.035, TRIM, verts=10)
    return w


wheel('wheel_front_left', 0.88, FRONT_AXLE, False)
wheel('wheel_front_right', -0.88, FRONT_AXLE, False)
wheel('wheel_rear_left', 0.9, REAR_AXLE, True)
wheel('wheel_rear_right', -0.9, REAR_AXLE, True)


# ---------------------------------------------------------------- tidy: one mesh per pivot per material
def merge_children():
    pivots = [o for o in bpy.data.objects if o.type == 'EMPTY']
    for p in pivots:
        groups = {}
        for c in p.children:
            if c.type != 'MESH':
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
print(f'TANEX_TRUCK triangles={tris} meshes={sum(1 for o in bpy.data.objects if o.type == "MESH")} materials={len(bpy.data.materials)}')

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format='GLB', export_yup=True, export_apply=True,
    export_texcoords=False, export_normals=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, use_selection=False,
)
print('TANEX_TRUCK exported', OUT_GLB)


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
    cam.data.lens = 50
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
    target = P(0, 1.5, 0)
    door_node = bpy.data.objects['cargo_door']
    for label, az, el, dist, opened in (('side', 0, 6, 14, 0), ('front', 40, 12, 14, 0), ('rear', -130, 14, 14, -100)):
        door_node.rotation_euler = (0, 0, math.radians(opened))
        a, e = math.radians(az), math.radians(el)
        pos = P(dist * math.cos(e) * math.cos(a), 1.5 + dist * math.sin(e), dist * math.cos(e) * math.sin(a))
        cam.location = pos
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = (target - pos).to_track_quat('-Z', 'Y')
        scene.render.filepath = f'{prefix}-{label}.png'
        bpy.ops.render.render(write_still=True)
        print('TANEX_TRUCK preview', scene.render.filepath)


if PREVIEW:
    preview(PREVIEW)
