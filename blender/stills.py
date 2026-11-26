# Cycles stills for the editorial images: the same studio as the live stage (components/quiren/gem-scene.ts),
# rendered with real refraction. Run: Blender -b -P blender/stills.py -- <outdir> [names...]
import bpy, bmesh, math, random, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/quiren"
ONLY = set(argv[1:])
FLOOR = -1.25
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.refresh_devices()
    for d in prefs.devices: d.use = d.type != "CPU"
    print("devices", [(d.name, d.type, d.use) for d in prefs.devices])
    sc.cycles.device = "GPU"
except Exception:
    pass
sc.cycles.samples = 80
sc.cycles.use_denoising = True
sc.render.use_persistent_data = True
sc.cycles.max_bounces = 16
sc.cycles.transmission_bounces = 14
sc.cycles.glossy_bounces = 6
sc.cycles.caustics_refractive = False
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Base Contrast"
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 82

def hexc(h, a=1.0):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)

def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    build(nt, out); return m

# ---------- world: cool slate above, bright haze at the horizon ----------
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(tc.outputs["Generated"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], ramp.inputs[0])
r = ramp.color_ramp
r.elements[0].position = 0.48; r.elements[0].color = hexc("#d4c6b8")
r.elements[1].position = 0.78; r.elements[1].color = hexc("#868e96")
e = r.elements.new(0.53); e.color = hexc("#dcdcda")
e = r.elements.new(0.6); e.color = hexc("#adb3b8")
nt.links.new(ramp.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 1.15
nt.links.new(bg.outputs[0], o.inputs[0])

# ---------- lights ----------
def sun(rot, color, strength, angle):
    d = bpy.data.lights.new("sun", "SUN"); d.color = hexc(color)[:3]; d.energy = strength; d.angle = math.radians(angle)
    ob = bpy.data.objects.new("sun", d); ob.rotation_euler = [math.radians(a) for a in rot]; sc.collection.objects.link(ob)
sun((48, 0, -55), "#ffe9d6", 3.2, 8)
sun((70, 0, 140), "#d4e2ff", 1.6, 15)

def link(ob): sc.collection.objects.link(ob); return ob

# ---------- floor: wet sand ----------
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, FLOOR, 0))
# Blender is Z-up: map three (x, y, z) -> blender (x, -z, y)
fl = bpy.context.object; fl.location = (0, 0, FLOOR)
def build_floor(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = hexc("#c8b6a2"); b.inputs["Roughness"].default_value = 0.12
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 3.0
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.04
    nt.links.new(n.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
fl.data.materials.append(mat("sand", build_floor))

def P(x, y, z): return Vector((x, -z, y))

# ---------- the stone ----------
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=7, radius=1)
ice = bpy.context.object; ice.name = "ice"
rnd = random.Random(7)
planes = []
for _ in range(13):
    n = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1) * 0.7, rnd.uniform(-1, 1))).normalized()
    planes.append((n, 0.68 + rnd.random() * 0.14))
for v in ice.data.vertices:
    d = v.co.copy()  # treat as three-space (x, y-up, z)
    t = Vector((d.x, d.z, -d.y))
    s = 1 + 0.17 * noise.noise(t * 1.5 + Vector((3.1, 0, 1.7)))
    t *= s
    for n, c in planes:
        dist = t.dot(n) - c
        if dist > 0: t -= n * dist * 0.8
    tp = 1 - 0.1 * max(0, min(1, (t.y + 0.3) / 1.3))
    t = Vector((t.x * 0.92 * tp, t.y * 1.3, t.z * 0.8 * tp))
    v.co = P(t.x, t.y, t.z)
minz = min(v.co.z for v in ice.data.vertices)
for v in ice.data.vertices: v.co.z += FLOOR - 0.06 - minz
bpy.ops.object.shade_smooth()
def build_ice(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = hexc("#f2f6f9"); b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.31
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 2.6; n1.inputs["Detail"].default_value = 8
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 5.5
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"]); nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs["From Min"].default_value = 0.35; rr.inputs["From Max"].default_value = 0.75
    rr.inputs["To Min"].default_value = 0.04; rr.inputs["To Max"].default_value = 0.42
    nt.links.new(n1.outputs[0], rr.inputs["Value"]); nt.links.new(rr.outputs[0], b.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.02
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 18; n2.inputs["Detail"].default_value = 10
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "ADD"
    nt.links.new(n2.outputs[0], mx.inputs[0]); nt.links.new(vor.outputs["Distance"], mx.inputs[1])
    nt.links.new(mx.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    # milky volume so the ice reads as frozen, not glass
    vol = nt.nodes.new("ShaderNodeVolumeScatter"); vol.inputs["Density"].default_value = 0.12; vol.inputs["Color"].default_value = hexc("#e8eef3")
    nt.links.new(b.outputs[0], out.inputs["Surface"]); nt.links.new(vol.outputs[0], out.inputs["Volume"])
ice.data.materials.append(mat("ice", build_ice))

# rime crust on the top: a slightly larger shell with a noise mask
bpy.ops.object.duplicate(); rime = bpy.context.object; rime.scale = (1.006, 1.006, 1.006)
rime.data = rime.data.copy(); rime.data.materials.clear()
def build_rime(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfDiffuse"); b.inputs["Color"].default_value = hexc("#f4f7fa")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 3.0; n.inputs["Detail"].default_value = 10
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"; add.inputs[1].default_value = 1.4; add.inputs[2].default_value = -0.85
    nt.links.new(sep.outputs["Z"], add.inputs[0])
    add2 = nt.nodes.new("ShaderNodeMath"); add2.operation = "ADD"
    nt.links.new(add.outputs[0], add2.inputs[0]); nt.links.new(n.outputs[0], add2.inputs[1])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[1].position = 0.7
    nt.links.new(add2.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], mix.inputs[0]); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(b.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
rime.data.materials.append(mat("rime", build_rime))

# the cross: three rounded arms
def capsule(length, rad, rot):
    bpy.ops.mesh.primitive_cylinder_add(radius=rad, depth=length, vertices=32)
    c = bpy.context.object
    bpy.ops.object.modifier_add(type="SUBSURF"); c.modifiers[-1].levels = 2
    for end in (length / 2, -length / 2):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rad, location=(0, 0, end), segments=32, ring_count=16)
        sph = bpy.context.object; sph.parent = c
    c.rotation_euler = rot
    return c
core = bpy.data.objects.new("core", None); link(core)
for ln, rd, rot in ((1.0, 0.18, (0, 0, 0)), (1.0, 0.18, (0, math.pi / 2, 0)), (0.62, 0.15, (math.pi / 2, 0, 0))):
    c = capsule(ln, rd, rot); c.parent = core
core.location = P(0, 0.12, 0)
core.rotation_euler = (0.32, math.pi / 4, 0.4)
def build_core(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = hexc("#d0532a"); b.inputs["Roughness"].default_value = 0.42
    b.inputs["Subsurface Weight"].default_value = 0.35; b.inputs["Subsurface Radius"].default_value = (0.6, 0.2, 0.1)
    b.inputs["Emission Color"].default_value = hexc("#e0703c"); b.inputs["Emission Strength"].default_value = 0.35
    nt.links.new(b.outputs[0], out.inputs[0])
cm = mat("core", build_core)
for ch in core.children_recursive:
    if ch.type == "MESH": ch.data.materials.append(cm)

# air: small white spheres scattered around the core
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1); proto = bpy.context.object
def build_air(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Base Color"].default_value = hexc("#ffffff"); b.inputs["Roughness"].default_value = 0.35
    b.inputs["Emission Color"].default_value = hexc("#f2f6fa"); b.inputs["Emission Strength"].default_value = 0.9
    nt.links.new(b.outputs[0], out.inputs[0])
proto.data.materials.append(mat("air", build_air))
ar = random.Random(31)
for i in range(1400):
    near = ar.random() < 0.45
    rad = (0.22 + ar.random() * 0.45) if near else (0.5 + ar.random() * 0.4)
    th = ar.random() * math.tau; ph = math.acos(ar.random() * 2 - 1)
    x = math.sin(ph) * math.cos(th) * rad * 0.78; y = math.cos(ph) * rad * 1.2 + 0.17; z = math.sin(ph) * math.sin(th) * rad * 0.66
    s = (0.005 + ar.random() * 0.009) if ar.random() > 0.05 else 0.02
    ob = proto.copy(); ob.location = P(x, y, z); ob.scale = (s, s, s); link(ob)
proto.location = (0, 0, -50)

# ---------- props ----------
def sphere(name, r, loc, color, rough, coat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=P(*loc), segments=64, ring_count=32); ob = bpy.context.object
    bpy.ops.object.shade_smooth()
    def b(nt, out):
        p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = hexc(color)
        p.inputs["Roughness"].default_value = rough; p.inputs["Coat Weight"].default_value = coat
        nt.links.new(p.outputs[0], out.inputs[0])
    ob.data.materials.append(mat(name, b)); return ob
sphere("ball", 0.46, (-3.7, FLOOR + 0.46, 0.4), "#7c8085", 0.14, 1.0)
sphere("orb", 0.3, (4.3, 0.1, -3.2), "#141414", 0.18, 1.0)

bpy.ops.mesh.primitive_torus_add(major_radius=7.5, minor_radius=0.55, major_segments=160, minor_segments=32, location=P(-9.5, 1.2, -16))
gate = bpy.context.object; gate.rotation_euler = (math.pi / 2, 0, 0.35); bpy.ops.object.shade_smooth()
def bg_gate(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = hexc("#e7ded2"); p.inputs["Roughness"].default_value = 0.85
    nt.links.new(p.outputs[0], out.inputs[0])
gate.data.materials.append(mat("gate", bg_gate))

# reeds: thin branching curves
cu = bpy.data.curves.new("reeds", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.006
rr = random.Random(91)
def stem(p0, d, length, depth):
    sp = cu.splines.new("POLY"); p1 = p0 + d * length
    sp.points.add(1); sp.points[0].co = (*p0, 1); sp.points[1].co = (*p1, 1)
    if depth < 5:
        for _ in range(2 + rr.randint(0, 1)):
            nd = (d + Vector((rr.uniform(-0.6, 0.6), rr.uniform(-0.3, 0.3), rr.uniform(-0.2, 0.4)))).normalized()
            stem(p1, nd, length * (0.58 + rr.random() * 0.2), depth + 1)
for base in ((-5.8, -4.5), (-4.6, -2.2), (-7.4, -7.0), (-5.2, -3.2)):
    for _ in range(4):
        p0 = P(base[0] + rr.uniform(-0.6, 0.6), FLOOR, base[1] + rr.uniform(-0.4, 0.4))
        stem(Vector(p0), Vector((rr.uniform(-0.25, 0.25), rr.uniform(-0.2, 0.2), 1)).normalized(), 0.55 + rr.random() * 0.35, 0)
reeds = bpy.data.objects.new("reeds", cu); link(reeds)
def b_reed(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = hexc("#a0623c"); p.inputs["Roughness"].default_value = 0.7
    nt.links.new(p.outputs[0], out.inputs[0])
cu.materials.append(mat("reed", b_reed))

# ---------- cameras (same poses as the live stage) ----------
POSES = {
    "frost": ((-0.25, 1.15, 1.75), (0.05, 0.85, 0), 34, 0.12, 1600, 1200),
    "orb": ((2.6, -0.05, 0.6), (4.3, 0.1, -3.2), 30, 0, 1600, 1200),
    "core": ((0.2, 0.15, 1.7), (0, 0.1, 0), 36, -0.2, 1600, 1200),
    "side": ((-2.1, 0.9, 2.4), (0, 0.3, 0), 34, 0.05, 1600, 1200),
    "wide": ((1.5, 0.15, 9.5), (-0.4, 0.15, 0), 30, 0, 2200, 950),
    "horizon": ((-2.2, -1.02, 3.4), (-3.7, -0.85, 0.4), 34, 0, 1600, 1200),
    "base": ((0.9, -0.85, 2.6), (0, -0.9, 0), 34, 0, 1600, 1200),
    "arch": ((-3.8, 0.4, 5.2), (-6.2, 0.6, -6), 38, 0, 1600, 1200),
}
cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd); link(cam); sc.camera = cam
cd.sensor_fit = "VERTICAL"
for name, (pos, tgt, fov, roll, W, H) in POSES.items():
    if ONLY and name not in ONLY: continue
    cam.location = P(*pos)
    d = P(*tgt) - P(*pos)
    q = d.to_track_quat("-Z", "Y"); cam.rotation_euler = q.to_euler()
    cam.rotation_euler.rotate_axis("Z", roll)
    cd.angle = math.radians(fov)
    sc.render.resolution_x = W; sc.render.resolution_y = H
    sc.render.filepath = f"{OUT}/{name}.jpg"
    bpy.ops.render.render(write_still=True)
    print("rendered", name)
