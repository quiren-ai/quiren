# The landing stage, rendered offline in Cycles and played back as a scroll-scrubbed image sequence.
# One camera path through the landing poses (components/quiren/stage-seq.ts reads the same key frames).
#
#   Blender -b -P blender/stage.py -- <outdir> [--frames 0-144] [--res 1600x900] [--samples 48]
#
# Coordinates are written in three.js space (x, y up, z toward the viewer) and mapped with P().
import bpy, math, random, sys
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/quiren-seq"
def opt(name, default):
    return argv[argv.index(name) + 1] if name in argv else default
F0, F1 = (int(x) for x in opt("--frames", "0-120").split("-"))
KEYS_ONLY = "--keys" in argv
RW, RH = (int(x) for x in opt("--res", "1600x900").split("x"))
SAMPLES = int(opt("--samples", "48"))
FLOOR = -1.25

def P(x, y, z): return Vector((x, -z, y))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.refresh_devices()
    for d in prefs.devices: d.use = d.type != "CPU"
    sc.cycles.device = "GPU"
except Exception:
    pass
sc.cycles.samples = SAMPLES
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.02
sc.cycles.use_denoising = True
sc.render.use_persistent_data = True
sc.cycles.max_bounces = 24
sc.cycles.transmission_bounces = 24
sc.cycles.volume_bounces = 1
sc.cycles.volume_step_rate = 4.0
sc.cycles.transparent_max_bounces = 64
sc.cycles.glossy_bounces = 4
sc.cycles.diffuse_bounces = 3
sc.cycles.caustics_refractive = False
sc.cycles.caustics_reflective = False
sc.cycles.blur_glossy = 1.0
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.view_settings.exposure = 0.0
sc.render.resolution_x, sc.render.resolution_y = RW, RH
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_depth = "8"

def hexc(h, a=1.0):
    h = h.lstrip("#"); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)

def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    build(nt, out); return m

def link(ob): sc.collection.objects.link(ob); return ob

# ---------- world: overcast slate overhead, a bright haze band at the horizon ----------
w = bpy.data.worlds.new("sky"); sc.world = w; w.use_nodes = True
nt = w.node_tree; nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground")
tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(tc.outputs["Generated"], sep.inputs[0]); nt.links.new(sep.outputs["Z"], ramp.inputs[0])
r = ramp.color_ramp
r.elements[0].position = 0.46; r.elements[0].color = hexc("#d8d5d2")
r.elements[1].position = 0.78; r.elements[1].color = hexc("#7a7f87")
for pos, col in ((0.5, "#ecebea"), (0.55, "#dcdcdf"), (0.65, "#c3c5cb")): e = r.elements.new(pos); e.color = hexc(col)
nt.links.new(ramp.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 1.1
import glob as _glob
hdr = (_glob.glob("/Applications/Blender.app/Contents/Resources/*/datafiles/studiolights/world/" + opt("--hdri", "courtyard") + ".exr") or [None])[0]
if hdr:
    env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hdr)
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = (0, 0, math.radians(float(opt("--hrot", "200"))))
    tco = nt.nodes.new("ShaderNodeTexCoord"); nt.links.new(tco.outputs["Generated"], mp.inputs[0]); nt.links.new(mp.outputs[0], env.inputs[0])
    bgh = nt.nodes.new("ShaderNodeBackground"); bgh.inputs[1].default_value = float(opt("--hstr", "0.9"))
    # desaturate the HDRI a little so the light stays neutral grey
    hsv = nt.nodes.new("ShaderNodeHueSaturation"); hsv.inputs["Saturation"].default_value = 0.35
    nt.links.new(env.outputs[0], hsv.inputs["Color"]); nt.links.new(hsv.outputs[0], bgh.inputs[0])
    lp = nt.nodes.new("ShaderNodeLightPath")
    m1 = nt.nodes.new("ShaderNodeMath"); m1.operation = "MAXIMUM"; nt.links.new(lp.outputs["Is Camera Ray"], m1.inputs[0]); nt.links.new(lp.outputs["Is Glossy Ray"], m1.inputs[1])
    # rays that left through the ice see the real surroundings, so the stone carries darker, varied tones
    m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "SUBTRACT"; nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(lp.outputs["Transmission Depth"], m2.inputs[1])
    m2.use_clamp = True
    mix = nt.nodes.new("ShaderNodeMixShader"); nt.links.new(m2.outputs[0], mix.inputs[0])
    nt.links.new(bgh.outputs[0], mix.inputs[1]); nt.links.new(bg.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], o.inputs[0])
else:
    nt.links.new(bg.outputs[0], o.inputs[0])

# soft key from the upper left, a cool fill from behind right
def sun(rot, color, strength, angle):
    d = bpy.data.lights.new("sun", "SUN"); d.color = hexc(color)[:3]; d.energy = strength; d.angle = math.radians(angle)
    ob = bpy.data.objects.new("sun", d); ob.rotation_euler = [math.radians(a) for a in rot]; link(ob)
sun((50, 0, -55), "#fff3e8", 2.2, 6)
sun((75, 0, 150), "#dbe6f5", 0.35, 30)

# ---------- the beach: real sand, rippled by wind and tide, water lying in the low parts ----------
WATER = FLOOR - 0.004
def build_beach(nt, out, displace=True, dry=0.0):
    """Wet beach sand. Height = tide ripples + broad undulation; troughs are wet and shiny, crests dry and matte."""
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    def node(t, **kw):
        n = nt.nodes.new(t)
        for k, v in kw.items(): n.inputs[k].default_value = v
        return n
    rip = nt.nodes.new("ShaderNodeTexWave"); rip.wave_type = "BANDS"; rip.bands_direction = "Y"
    rip.inputs["Scale"].default_value = 6.5; rip.inputs["Distortion"].default_value = 5.5; rip.inputs["Detail"].default_value = 3; rip.inputs["Detail Scale"].default_value = 1.6
    nt.links.new(tc.outputs["Object"], rip.inputs["Vector"])
    big = node("ShaderNodeTexNoise", Scale=0.22, Detail=4.0); nt.links.new(tc.outputs["Object"], big.inputs["Vector"])
    # height in metres around 0: ripples 1.4 cm, swells 5 cm
    r1 = nt.nodes.new("ShaderNodeMath"); r1.operation = "MULTIPLY_ADD"; r1.inputs[1].default_value = 0.014; r1.inputs[2].default_value = -0.007
    nt.links.new(rip.outputs["Color"], r1.inputs[0])
    b1 = nt.nodes.new("ShaderNodeMath"); b1.operation = "MULTIPLY_ADD"; b1.inputs[1].default_value = 0.1; b1.inputs[2].default_value = -0.05
    nt.links.new(big.outputs[0], b1.inputs[0])
    hgt = nt.nodes.new("ShaderNodeMath"); hgt.operation = "ADD"; nt.links.new(r1.outputs[0], hgt.inputs[0]); nt.links.new(b1.outputs[0], hgt.inputs[1])
    if displace:
        d = nt.nodes.new("ShaderNodeDisplacement"); d.inputs["Midlevel"].default_value = 0.0; d.inputs["Scale"].default_value = 1.0
        nt.links.new(hgt.outputs[0], d.inputs["Height"]); nt.links.new(d.outputs[0], out.inputs["Displacement"])
    # wetness: low ground is wet; drier on crests
    wet = nt.nodes.new("ShaderNodeMapRange"); wet.inputs["From Min"].default_value = 0.012 + dry; wet.inputs["From Max"].default_value = -0.006 + dry
    nt.links.new(hgt.outputs[0], wet.inputs["Value"])
    # grains: fine cells of slightly different sand colours
    vg = nt.nodes.new("ShaderNodeTexVoronoi"); vg.inputs["Scale"].default_value = 900
    nt.links.new(tc.outputs["Object"], vg.inputs["Vector"])
    gr = nt.nodes.new("ShaderNodeValToRGB"); cr = gr.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = hexc("#9c8467")
    cr.elements[1].position = 1.0; cr.elements[1].color = hexc("#e6d9c6")
    e = cr.elements.new(0.5); e.color = hexc("#cbb597")
    e = cr.elements.new(0.92); e.color = hexc("#f2ece2")
    sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(vg.outputs["Color"], sep.inputs[0]); nt.links.new(sep.outputs[0], gr.inputs[0])
    sn = node("ShaderNodeTexNoise", Scale=3.0, Detail=6.0); nt.links.new(tc.outputs["Object"], sn.inputs["Vector"])
    tone = nt.nodes.new("ShaderNodeMix"); tone.data_type = "RGBA"; tone.blend_type = "MULTIPLY"; tone.inputs["Factor"].default_value = 0.35
    nt.links.new(gr.outputs[0], tone.inputs[6]); nt.links.new(sn.outputs["Color"], tone.inputs[7])
    darken = nt.nodes.new("ShaderNodeMix"); darken.data_type = "RGBA"; darken.blend_type = "MULTIPLY"
    darken.inputs[7].default_value = hexc("#8f8579")
    nt.links.new(wet.outputs[0], darken.inputs["Factor"]); nt.links.new(tone.outputs[2], darken.inputs[6])
    nt.links.new(darken.outputs[2], b.inputs["Base Color"])
    rg = nt.nodes.new("ShaderNodeMapRange"); rg.inputs["To Min"].default_value = 0.82; rg.inputs["To Max"].default_value = 0.06
    nt.links.new(wet.outputs[0], rg.inputs["Value"]); nt.links.new(rg.outputs[0], b.inputs["Roughness"])
    # grain relief, weaker where water smooths it
    gn = node("ShaderNodeTexNoise", Scale=1400.0, Detail=2.0); nt.links.new(tc.outputs["Object"], gn.inputs["Vector"])
    bs = nt.nodes.new("ShaderNodeMapRange"); bs.inputs["To Min"].default_value = 0.35; bs.inputs["To Max"].default_value = 0.05
    nt.links.new(wet.outputs[0], bs.inputs["Value"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Distance"].default_value = 0.002
    nt.links.new(bs.outputs[0], bump.inputs["Strength"]); nt.links.new(gn.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs["Surface"])
def set_true_disp(m):
    for target in (m, getattr(m, "cycles", None)):
        try: target.displacement_method = "DISPLACEMENT"; return
        except Exception: pass
# near beach: a dense grid so the ripples are real geometry
bpy.ops.mesh.primitive_grid_add(x_subdivisions=1300, y_subdivisions=1300, size=26, location=P(0, FLOOR, -3)); fl = bpy.context.object
beach_m = mat("beach", build_beach); set_true_disp(beach_m); fl.data.materials.append(beach_m)
# far beach, shaded only
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, FLOOR - 0.03)); far = bpy.context.object
far.data.materials.append(mat("beachfar", lambda nt, out: build_beach(nt, out, displace=False)))
# a film of water that floods only the hollows
bpy.ops.mesh.primitive_plane_add(size=60, location=P(0, WATER, -3)); wt = bpy.context.object
def build_water(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Base Color"].default_value = hexc("#f2efea")
    b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["IOR"].default_value = 1.33; b.inputs["Roughness"].default_value = 0.015
    tc = nt.nodes.new("ShaderNodeTexCoord"); wv = nt.nodes.new("ShaderNodeTexNoise"); wv.inputs["Scale"].default_value = 3; wv.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.02; bump.inputs["Distance"].default_value = 0.01
    nt.links.new(wv.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
wt.data.materials.append(mat("water", build_water))

def build_sand(nt, out, light="#d2c2ab", dark="#8c6b52"):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Roughness"].default_value = 0.85
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 6; n.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"; add.inputs[1].default_value = 0.35
    nt.links.new(n.outputs[0], add.inputs[0]); nt.links.new(sep.outputs["Z"], add.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.45; cr.elements[0].color = hexc(dark)
    cr.elements[1].position = 0.9; cr.elements[1].color = hexc(light)
    nt.links.new(add.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    gn = nt.nodes.new("ShaderNodeTexNoise"); gn.inputs["Scale"].default_value = 300
    nt.links.new(tc.outputs["Object"], gn.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.12
    nt.links.new(gn.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
def dune(name, loc, scale, light="#d2c2ab", dark="#8c6b52"):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=128, ring_count=64, location=P(*loc)); d = bpy.context.object; d.name = name
    d.scale = scale
    t = bpy.data.textures.new(name + "n", "CLOUDS"); t.noise_scale = 0.6
    dm = d.modifiers.new("d", "DISPLACE"); dm.texture = t; dm.strength = 0.08
    bpy.ops.object.shade_smooth()
    d.data.materials.append(mat(name, lambda nt, out: build_sand(nt, out, light, dark))); return d

# ---------- the wall with the round opening (plaster, thick, its rim catches the light) ----------
import bmesh
def annulus(name, r_in, r_out, seg=256):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    inner = [bm.verts.new((math.cos(a) * r_in, 0, math.sin(a) * r_in)) for a in (i / seg * math.tau for i in range(seg))]
    outer = [bm.verts.new((math.cos(a) * r_out, 0, math.sin(a) * r_out)) for a in (i / seg * math.tau for i in range(seg))]
    for i in range(seg):
        j = (i + 1) % seg; bm.faces.new((inner[i], inner[j], outer[j], outer[i]))
    bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))
hole_c, hole_r = P(1.6, 2.6, -11), 11.5
wall = annulus("wall", hole_r, hole_r + 3.4); wall.location = hole_c
sol = wall.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 2.4; sol.offset = 0
bev = wall.modifiers.new("bevel", "BEVEL"); bev.width = 0.35; bev.segments = 6; bev.limit_method = "ANGLE"
for p in wall.data.polygons: p.use_smooth = True
def build_plaster(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Base Color"].default_value = hexc("#c9c4bd"); b.inputs["Roughness"].default_value = 0.85
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 40; n.inputs["Detail"].default_value = 12
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
    nt.links.new(n.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
wall.data.materials.append(mat("plaster", build_plaster))

# ---------- the sand bank the stone stands on: its wet shoreline passes right in front of the stone ----------
def build_bank(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 40; n.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    hz = nt.nodes.new("ShaderNodeMath"); hz.operation = "MULTIPLY_ADD"; hz.inputs[1].default_value = 0.06
    nt.links.new(n.outputs[0], hz.inputs[0]); nt.links.new(sep.outputs["Z"], hz.inputs[2])
    # height above the waterline: dark wet line at the edge, damp band, then dry pale sand
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.36; cr.elements[0].color = hexc("#8f7560")
    cr.elements[1].position = 0.62; cr.elements[1].color = hexc("#d3c3ad")
    e = cr.elements.new(0.43); e.color = hexc("#a98e76")
    e = cr.elements.new(0.5); e.color = hexc("#b89a7c")
    nt.links.new(hz.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    rg = nt.nodes.new("ShaderNodeMapRange"); rg.inputs["From Min"].default_value = 0.38; rg.inputs["From Max"].default_value = 0.55
    rg.inputs["To Min"].default_value = 0.12; rg.inputs["To Max"].default_value = 0.85
    nt.links.new(hz.outputs[0], rg.inputs["Value"]); nt.links.new(rg.outputs[0], b.inputs["Roughness"])
    gn = nt.nodes.new("ShaderNodeTexNoise"); gn.inputs["Scale"].default_value = 260
    nt.links.new(tc.outputs["Object"], gn.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.1
    nt.links.new(gn.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=256, ring_count=128, location=P(0.0, FLOOR - 0.1, 0.0)); bank = bpy.context.object
bank.scale = (1.0, 0.85, 0.17)
bt = bpy.data.textures.new("bankn", "CLOUDS"); bt.noise_scale = 0.12; bt.noise_depth = 4
bd = bank.modifiers.new("d", "DISPLACE"); bd.texture = bt; bd.strength = 0.06
bpy.ops.object.shade_smooth()
bank_m = mat("pile", lambda nt, out: build_beach(nt, out, displace=False, dry=-0.04)); bank.data.materials.append(bank_m)
def grains(emitter, name, color, count, size, seed, emission=0.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0, 0, -60)); g = bpy.context.object; g.name = name
    def bg(nt, out):
        p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = hexc(color); p.inputs["Roughness"].default_value = 0.6
        if emission: p.inputs["Emission Color"].default_value = hexc(color); p.inputs["Emission Strength"].default_value = emission
        nt.links.new(p.outputs[0], out.inputs[0])
    g.data.materials.append(mat(name + "m", bg))
    m = emitter.modifiers.new(name, "PARTICLE_SYSTEM"); ps = m.particle_system.settings
    ps.type = "HAIR"; ps.count = count; ps.hair_length = 0.01; ps.render_type = "OBJECT"; ps.instance_object = g
    ps.particle_size = size; ps.size_random = 0.7; ps.use_rotations = True; ps.rotation_mode = "NONE"; ps.phase_factor_random = 2.0; ps.use_advanced_hair = True
    m.particle_system.seed = seed
grains(bank, "sandgrain", "#c4ad8f", 90000, 0.0035, 3)
grains(bank, "sandgrain2", "#8e7660", 30000, 0.003, 4)
grains(bank, "frostgrain", "#f6f7f9", 40000, 0.004, 5, emission=0.15)

# a dune rising at the left, shrubs on its flank
DUNE = ((-6.5, FLOOR - 0.6, -5.5), (5.5, 4.5, 2.0))
ld = dune("leftdune", DUNE[0], DUNE[1]); ld.data.materials.clear(); ld.data.materials.append(mat("dunesand", lambda nt, out: build_beach(nt, out, displace=False, dry=-0.06)))
def dune_h(x, z):
    (cx, cy, cz), (sx, sz, sh) = DUNE
    q = 1 - ((x - cx) / sx) ** 2 - ((z - cz) / sz) ** 2
    return cy + sh * math.sqrt(q) if q > 0 else FLOOR

# ---------- far shore: a long low dune ridge across the horizon, a slope rising behind the opening ----------
ridge = dune("ridge", (6.0, FLOOR - 0.45, -5.0), (40, 2.2, 0.95), light="#c39c77", dark="#36231a")
def build_ridge(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(geo.outputs["Position"], sep.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord"); n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 3; n.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    h = nt.nodes.new("ShaderNodeMath"); h.operation = "SUBTRACT"; h.inputs[1].default_value = WATER
    nt.links.new(sep.outputs["Z"], h.inputs[0])
    hn = nt.nodes.new("ShaderNodeMath"); hn.operation = "MULTIPLY_ADD"; hn.inputs[1].default_value = 0.04
    nt.links.new(n.outputs[0], hn.inputs[0]); nt.links.new(h.outputs[0], hn.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.05; cr.elements[0].color = hexc("#2b1a12")
    cr.elements[1].position = 0.5; cr.elements[1].color = hexc("#c69f79")
    e = cr.elements.new(0.17); e.color = hexc("#4f3424")
    e = cr.elements.new(0.3); e.color = hexc("#9d785a")
    nt.links.new(hn.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    rg = nt.nodes.new("ShaderNodeMapRange"); rg.inputs["From Min"].default_value = 0.12; rg.inputs["From Max"].default_value = 0.35
    rg.inputs["To Min"].default_value = 0.15; rg.inputs["To Max"].default_value = 0.8
    nt.links.new(hn.outputs[0], rg.inputs["Value"]); nt.links.new(rg.outputs[0], b.inputs["Roughness"])
    nt.links.new(b.outputs[0], out.inputs[0])
ridge.data.materials.clear(); ridge.data.materials.append(mat("ridgem", build_ridge))
dune("slope", (-11.0, FLOOR - 1.0, -20.0), (9, 7, 4.2), light="#dccdb8", dark="#a88b70")

# ---------- the sand the stone is set into ----------
for i in range(0):
    a = i / 5 * math.tau + 0.4
    lump = dune(f"lump{i}", (math.cos(a) * 0.75, FLOOR - 0.06, math.sin(a) * 0.55), (0.34 + 0.1 * (i % 2), 0.28, 0.1), light="#f4f4f5", dark="#d2d1d3")
    lump.modifiers["d"].strength = 0.15

# ---------- the stone: frosted ice, milky inside ----------
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=7, radius=1); ice = bpy.context.object; ice.name = "ice"
rnd = random.Random(7)
planes = []
for _ in range(13):
    n = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1) * 0.7, rnd.uniform(-1, 1))).normalized()
    planes.append((n, 0.68 + rnd.random() * 0.14))
for v in ice.data.vertices:
    t = Vector((v.co.x, v.co.z, -v.co.y))
    t *= 1 + 0.22 * noise.noise(t * 1.3 + Vector((3.1, 0, 1.7))) + 0.05 * noise.noise(t * 4.0)
    for n, c in planes:
        dist = t.dot(n) - c
        if dist > 0: t -= n * dist * 0.45
    tp = 1 - 0.26 * max(0.0, min(1.0, (t.y + 0.2) / 1.2))
    t = Vector((t.x * 0.9 * tp, t.y * 1.42, t.z * 0.8 * tp))
    v.co = P(t.x, t.y, t.z)
minz = min(v.co.z for v in ice.data.vertices)
for v in ice.data.vertices: v.co.z += FLOOR - 0.06 - minz
sm = ice.modifiers.new("smooth", "SMOOTH"); sm.factor = 0.8; sm.iterations = 6
vt = bpy.data.textures.new("icefacets", "VORONOI"); vt.noise_scale = 0.42; vt.distance_metric = "DISTANCE"
dv = ice.modifiers.new("facets", "DISPLACE"); dv.texture = vt; dv.strength = -0.07; dv.mid_level = 0.0; dv.texture_coords = "LOCAL"
ct = bpy.data.textures.new("icemelt", "CLOUDS"); ct.noise_scale = 0.09; ct.noise_depth = 3
dc = ice.modifiers.new("melt", "DISPLACE"); dc.texture = ct; dc.strength = 0.018; dc.texture_coords = "LOCAL"
bpy.ops.object.shade_smooth()
ice.rotation_euler = (0, math.radians(14), math.radians(20))  # a slight lean, like the reference
def build_ice(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = hexc("#e9e6f0"); b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["IOR"].default_value = 1.31
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 2.2; n1.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
    rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs["From Min"].default_value = 0.35; rr.inputs["From Max"].default_value = 0.72
    rr.inputs["To Min"].default_value = 0.08; rr.inputs["To Max"].default_value = 0.4
    nt.links.new(n1.outputs[0], rr.inputs["Value"]); nt.links.new(rr.outputs[0], b.inputs["Roughness"])
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 16; n2.inputs["Detail"].default_value = 12
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 4.5
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"]); nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "ADD"
    nt.links.new(n2.outputs[0], mx.inputs[0]); nt.links.new(vor.outputs["Distance"], mx.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.02
    nt.links.new(mx.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    # milky volume, denser in clouds, so the cross reads as deep inside
    vol = nt.nodes.new("ShaderNodeVolumeScatter"); vol.inputs["Color"].default_value = hexc("#e4e1ec")
    n3 = nt.nodes.new("ShaderNodeTexNoise"); n3.inputs["Scale"].default_value = 3.2; n3.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], n3.inputs["Vector"])
    dr = nt.nodes.new("ShaderNodeMapRange"); dr.inputs["From Min"].default_value = 0.35; dr.inputs["From Max"].default_value = 0.7
    dr.inputs["To Min"].default_value = 0.15; dr.inputs["To Max"].default_value = 0.9
    nt.links.new(n3.outputs[0], dr.inputs["Value"]); nt.links.new(dr.outputs[0], vol.inputs["Density"])
    ab = nt.nodes.new("ShaderNodeVolumeAbsorption"); ab.inputs["Color"].default_value = hexc("#cfc8e0"); ab.inputs["Density"].default_value = 0.55
    vadd = nt.nodes.new("ShaderNodeAddShader"); nt.links.new(vol.outputs[0], vadd.inputs[0]); nt.links.new(ab.outputs[0], vadd.inputs[1])
    # frost: white rime toward the top and in a few patches, mixed into the same surface
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    fn = nt.nodes.new("ShaderNodeTexNoise"); fn.inputs["Scale"].default_value = 2.2; fn.inputs["Detail"].default_value = 14; fn.inputs["Distortion"].default_value = 1.5
    nt.links.new(tc.outputs["Object"], fn.inputs["Vector"])
    fa = nt.nodes.new("ShaderNodeMath"); fa.operation = "MULTIPLY_ADD"; fa.inputs[1].default_value = 0.75; fa.inputs[2].default_value = -0.5
    nt.links.new(sep.outputs["Z"], fa.inputs[0])
    fa2 = nt.nodes.new("ShaderNodeMath"); fa2.operation = "ADD"; nt.links.new(fa.outputs[0], fa2.inputs[0]); nt.links.new(fn.outputs[0], fa2.inputs[1])
    fr_ = nt.nodes.new("ShaderNodeValToRGB"); fr_.color_ramp.elements[0].position = 0.46; fr_.color_ramp.elements[1].position = 0.64
    nt.links.new(fa2.outputs[0], fr_.inputs[0])
    frost = nt.nodes.new("ShaderNodeBsdfPrincipled"); frost.inputs["Base Color"].default_value = hexc("#f1f2f6"); frost.inputs["Roughness"].default_value = 0.55; frost.inputs["Transmission Weight"].default_value = 0.35
    nt.links.new(bump.outputs[0], frost.inputs["Normal"])
    mx2 = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fr_.outputs[0], mx2.inputs[0]); nt.links.new(b.outputs[0], mx2.inputs[1]); nt.links.new(frost.outputs[0], mx2.inputs[2])
    nt.links.new(mx2.outputs[0], out.inputs["Surface"]); nt.links.new(vadd.outputs[0], out.inputs["Volume"])
ice.data.materials.append(mat("ice", build_ice))


# feathery fractures inside the ice: thin warped sheets, white where the noise allows
def build_crack(nt, out):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 9; n.inputs["Detail"].default_value = 14; n.inputs["Roughness"].default_value = 0.7
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    g = nt.nodes.new("ShaderNodeVectorMath"); g.operation = "LENGTH"; nt.links.new(tc.outputs["Object"], g.inputs[0])
    fall = nt.nodes.new("ShaderNodeMapRange"); fall.inputs["From Min"].default_value = 1.0; fall.inputs["From Max"].default_value = 0.2
    nt.links.new(g.outputs["Value"], fall.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; nt.links.new(n.outputs[0], mul.inputs[0]); nt.links.new(fall.outputs[0], mul.inputs[1])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].position = 0.36; ramp.color_ramp.elements[1].position = 0.6
    nt.links.new(mul.outputs[0], ramp.inputs[0])
    wh = nt.nodes.new("ShaderNodeBsdfPrincipled"); wh.inputs["Base Color"].default_value = hexc("#f7f8fa"); wh.inputs["Roughness"].default_value = 0.35
    wh.inputs["Emission Color"].default_value = hexc("#eef0f4"); wh.inputs["Emission Strength"].default_value = 0.12
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(ramp.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(wh.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
crack_m = mat("crack", build_crack)
kr = random.Random(23)
for i in range(9):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=40, size=1); ck = bpy.context.object
    ck.location = P(kr.uniform(-0.3, 0.3), kr.uniform(-0.6, 0.75), kr.uniform(-0.2, 0.2))
    s_ = kr.uniform(0.35, 0.7); ck.scale = (s_, s_ * kr.uniform(0.6, 1.0), 1)
    ck.rotation_euler = (kr.uniform(0, 3.1), kr.uniform(0, 3.1), kr.uniform(0, 3.1))
    cw = ck.modifiers.new("w", "DISPLACE"); cw.texture = ct; cw.strength = 0.12
    ck.data.materials.append(crack_m)

# the body inside: six equal rounded arms, deep terracotta
def capsule(length, rad, rot):
    bpy.ops.mesh.primitive_cylinder_add(radius=rad * 0.82, depth=length * 0.85, vertices=32)
    c = bpy.context.object
    bpy.ops.object.modifier_add(type="SUBSURF"); c.modifiers[-1].levels = 2
    for end in (length / 2, -length / 2):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rad * 0.82, location=(0, 0, end), segments=32, ring_count=16); bpy.context.object.scale = (1, 1, 1.35)
        bpy.ops.object.shade_smooth(); bpy.context.object.parent = c
    c.rotation_euler = rot
    return c
core = link(bpy.data.objects.new("core", None))
for ln, rd, rot in ((0.82, 0.3, (0, 0, 0)), (0.82, 0.3, (0, math.pi / 2, 0)), (0.82, 0.3, (math.pi / 2, 0, 0))):
    capsule(ln, rd, rot).parent = core
core.location = P(0, 0.0, 0); core.scale = (0.66, 0.66, 0.66)
def build_core(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.45
    b.inputs["Subsurface Weight"].default_value = 0.45; b.inputs["Subsurface Radius"].default_value = (0.5, 0.15, 0.08)
    b.inputs["Emission Color"].default_value = hexc("#e8782f"); b.inputs["Emission Strength"].default_value = 0.35
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 55; n.inputs["Detail"].default_value = 15; n.inputs["Roughness"].default_value = 0.65
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    # base terracotta with darker pits, then frost where the noise peaks
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.3; cr.elements[0].color = hexc("#8a3416")
    cr.elements[1].position = 0.62; cr.elements[1].color = hexc("#e0793a")
    e = cr.elements.new(0.74); e.color = hexc("#f0b383")
    e = cr.elements.new(0.8); e.color = hexc("#f6f3f1")
    # darker, redder toward the tips of each arm
    tg = nt.nodes.new("ShaderNodeVectorMath"); tg.operation = "LENGTH"; nt.links.new(tc.outputs["Object"], tg.inputs[0])
    tip = nt.nodes.new("ShaderNodeMapRange"); tip.inputs["From Min"].default_value = 0.25; tip.inputs["From Max"].default_value = 0.6
    nt.links.new(tg.outputs["Value"], tip.inputs["Value"])
    tsub = nt.nodes.new("ShaderNodeMath"); tsub.operation = "MULTIPLY_ADD"; tsub.inputs[1].default_value = -0.3
    nt.links.new(tip.outputs[0], tsub.inputs[0]); nt.links.new(n.outputs[0], tsub.inputs[2])
    nt.links.new(tsub.outputs[0], ramp.inputs[0])
    # hoar frost: a crackle of thin white veins over the clay
    vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.feature = "DISTANCE_TO_EDGE"; vo.inputs["Scale"].default_value = 26
    wn = nt.nodes.new("ShaderNodeTexNoise"); wn.inputs["Scale"].default_value = 8; wn.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], wn.inputs["Vector"])
    warp = nt.nodes.new("ShaderNodeMix"); warp.data_type = "VECTOR"; warp.inputs["Factor"].default_value = 0.12
    nt.links.new(tc.outputs["Object"], warp.inputs[4]); nt.links.new(wn.outputs["Color"], warp.inputs[5]); nt.links.new(warp.outputs[1], vo.inputs["Vector"])
    vr = nt.nodes.new("ShaderNodeMapRange"); vr.inputs["From Min"].default_value = 0.06; vr.inputs["From Max"].default_value = 0.0
    nt.links.new(vo.outputs["Distance"], vr.inputs["Value"])
    pm = nt.nodes.new("ShaderNodeTexNoise"); pm.inputs["Scale"].default_value = 3.5
    nt.links.new(tc.outputs["Object"], pm.inputs["Vector"])
    pmr = nt.nodes.new("ShaderNodeMapRange"); pmr.inputs["From Min"].default_value = 0.42; pmr.inputs["From Max"].default_value = 0.62
    nt.links.new(pm.outputs[0], pmr.inputs["Value"])
    vm = nt.nodes.new("ShaderNodeMath"); vm.operation = "MULTIPLY"; nt.links.new(vr.outputs[0], vm.inputs[0]); nt.links.new(pmr.outputs[0], vm.inputs[1])
    vmix = nt.nodes.new("ShaderNodeMix"); vmix.data_type = "RGBA"; vmix.inputs[7].default_value = hexc("#f3eee9")
    nt.links.new(vm.outputs[0], vmix.inputs["Factor"]); nt.links.new(ramp.outputs[0], vmix.inputs[6])
    nt.links.new(vmix.outputs[2], b.inputs["Base Color"])
    hsum = nt.nodes.new("ShaderNodeMath"); hsum.operation = "MULTIPLY_ADD"; hsum.inputs[1].default_value = 0.6
    nt.links.new(vm.outputs[0], hsum.inputs[0]); nt.links.new(n.outputs[0], hsum.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.7; bump.inputs["Distance"].default_value = 0.01
    nt.links.new(hsum.outputs[0], bump.inputs["Height"]); nt.links.new(bump.outputs[0], b.inputs["Normal"])
    nt.links.new(b.outputs[0], out.inputs[0])
cm = mat("core", build_core)
for ch in core.children_recursive:
    if ch.type == "MESH": ch.data.materials.append(cm)

# trapped air
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1); proto = bpy.context.object
def build_air(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Base Color"].default_value = hexc("#ffffff"); b.inputs["Roughness"].default_value = 0.3
    b.inputs["Emission Color"].default_value = hexc("#f2f6fa"); b.inputs["Emission Strength"].default_value = 0.6
    nt.links.new(b.outputs[0], out.inputs[0])
proto.data.materials.append(mat("air", build_air))
ar = random.Random(31)
for i in range(1600):
    rad = (0.18 + ar.random() * 0.4) if ar.random() < 0.5 else (0.45 + ar.random() * 0.4)
    th = ar.random() * math.tau; ph = math.acos(ar.random() * 2 - 1)
    x = math.sin(ph) * math.cos(th) * rad * 0.7; y = math.cos(ph) * rad * 1.3 + 0.05; z = math.sin(ph) * math.sin(th) * rad * 0.6
    s = (0.004 + ar.random() * 0.008) if ar.random() > 0.05 else 0.016
    ob = proto.copy(); ob.location = P(x, y, z); ob.scale = (s, s, s); link(ob)
proto.location = (0, 0, -50)
bpy.ops.mesh.primitive_plane_add(size=1); flake = bpy.context.object
def build_flake(nt, out):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.inputs["Base Color"].default_value = hexc("#ffffff"); b.inputs["Roughness"].default_value = 0.5
    b.inputs["Emission Color"].default_value = hexc("#f4f6f8"); b.inputs["Emission Strength"].default_value = 0.7
    nt.links.new(b.outputs[0], out.inputs[0])
flake.data.materials.append(mat("flake", build_flake))
fr = random.Random(5)
for i in range(600):
    rad = 0.25 + fr.random() * 0.6
    th = fr.random() * math.tau; ph = math.acos(fr.random() * 2 - 1)
    x = math.sin(ph) * math.cos(th) * rad * 0.7; y = math.cos(ph) * rad * 1.35 + 0.05; z = math.sin(ph) * math.sin(th) * rad * 0.6
    s = 0.005 + fr.random() ** 3 * 0.025
    ob = flake.copy(); ob.location = P(x, y, z); ob.scale = (s, s * (0.3 + fr.random() * 0.7), s)
    ob.rotation_euler = (fr.random() * 6.3, fr.random() * 6.3, fr.random() * 6.3); link(ob)
flake.location = (0, 0, -50)

# ---------- props ----------
def marble(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.32; p.inputs["Coat Weight"].default_value = 0.25; p.inputs["Coat Roughness"].default_value = 0.12
    p.inputs["Subsurface Weight"].default_value = 0.15; p.inputs["Subsurface Radius"].default_value = (0.08, 0.08, 0.08)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 2.2; n.inputs["Detail"].default_value = 10; n.inputs["Roughness"].default_value = 0.62
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 0.55; wv.inputs["Distortion"].default_value = 9; wv.inputs["Detail"].default_value = 4
    wv.inputs["Detail Scale"].default_value = 1.2; wv.inputs["Detail Roughness"].default_value = 0.55
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = hexc("#d9d9d6")
    cr.elements[1].position = 0.12; cr.elements[1].color = hexc("#4b4d50")
    e = cr.elements.new(0.035); e.color = hexc("#7d7f82")
    e = cr.elements.new(0.6); e.color = hexc("#3c3e41")
    nt.links.new(wv.outputs["Fac"], ramp.inputs[0])
    tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"; tint.inputs["Factor"].default_value = 0.4
    nt.links.new(ramp.outputs[0], tint.inputs[6]); nt.links.new(n.outputs["Color"], tint.inputs[7])
    nt.links.new(tint.outputs[2], p.inputs["Base Color"])
    nt.links.new(p.outputs[0], out.inputs[0])
def sphere(name, r, loc, build):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=P(*loc), segments=96, ring_count=48); ob = bpy.context.object
    bpy.ops.object.shade_smooth(); ob.data.materials.append(mat(name, build)); return ob
ball = sphere("ball", 0.3, (-2.0, FLOOR + 0.3, 0.5), marble); ball.rotation_euler = (0.4, 1.2, 0.2)
def onyx(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Base Color"].default_value = hexc("#121212"); p.inputs["Roughness"].default_value = 0.16
    p.inputs["Coat Weight"].default_value = 1.0; p.inputs["Coat Roughness"].default_value = 0.04
    nt.links.new(p.outputs[0], out.inputs[0])
orb = sphere("orb", 0.3, (2.9, 0.1, -4.2), onyx)

# dry beach shrubs: dense twiggy crowns, warm brown, darker at the base
cu = bpy.data.curves.new("shrubs", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 1.0; cu.bevel_resolution = 0
rr = random.Random(91)
def stem(p0, d, length, rad, depth, maxd):
    sp = cu.splines.new("POLY"); p1 = p0 + d * length
    mid = (p0 + p1) / 2 + Vector((rr.uniform(-0.02, 0.02), rr.uniform(-0.02, 0.02), rr.uniform(-0.01, 0.02)))
    sp.points.add(2)
    for i, (p, rd) in enumerate(((p0, rad), (mid, rad * 0.85), (p1, rad * 0.7))): sp.points[i].co = (*p, 1); sp.points[i].radius = rd
    if depth < maxd:
        for _ in range(2 + (rr.random() < 0.6)):
            nd = (d * 0.6 + Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-0.1, 0.7))) * 0.6).normalized()
            stem(p1, nd, length * (0.74 + rr.random() * 0.12), rad * 0.66, depth + 1, maxd)
def shrub(x, z, size, ground=FLOOR):
    for _ in range(20):
        p0 = Vector(P(x + rr.uniform(-0.15, 0.15) * size, ground, z + rr.uniform(-0.15, 0.15) * size))
        d = Vector((rr.uniform(-1.6, 1.6), rr.uniform(-1.6, 1.6), 1)).normalized()
        stem(p0, d, 0.13 * size, 0.005 * size, 0, 8)
# beach at the left, in front of the wall
for x, z, sz in ((-3.6, -4.2, 1.7), (-4.8, -5.2, 2.1), (-2.8, -3.2, 1.2), (-6.0, -6.2, 2.0), (-3.3, -5.6, 1.5), (-2.4, -2.2, 0.9)):
    shrub(x, z, sz, ground=max(FLOOR, dune_h(x, z)) - 0.05)
# on the slope seen through the opening
for x, z, sz in ((-9.0, -16.0, 2.2), (-11.5, -17.0, 2.6), (-7.6, -14.8, 1.6)):
    shrub(x, z, sz, ground=FLOOR + 1.1)
shrubs = link(bpy.data.objects.new("shrubs", cu))
def b_shrub(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled"); p.inputs["Roughness"].default_value = 0.75
    p.inputs["Subsurface Weight"].default_value = 0.25; p.inputs["Subsurface Radius"].default_value = (0.3, 0.15, 0.08)
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = FLOOR; mr.inputs["From Max"].default_value = FLOOR + 1.8
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = hexc("#4a2e1d")
    cr.elements[1].position = 1.0; cr.elements[1].color = hexc("#b47e52")
    e = cr.elements.new(0.45); e.color = hexc("#7a4b2c")
    nt.links.new(mr.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], p.inputs["Base Color"])
    nt.links.new(p.outputs[0], out.inputs[0])
cu.materials.append(mat("shrub", b_shrub))

# ---------- air: a faint haze so distance reads ----------
bpy.ops.mesh.primitive_cube_add(size=80, location=(0, 0, 30)); haze = bpy.context.object
def build_haze(nt, out):
    v = nt.nodes.new("ShaderNodeVolumeScatter"); v.inputs["Color"].default_value = hexc("#e9e6e2"); v.inputs["Density"].default_value = float(opt("--haze", "0.005")); v.inputs["Anisotropy"].default_value = 0.35
    nt.links.new(v.outputs[0], out.inputs["Volume"])
haze.data.materials.append(mat("haze", build_haze))
haze.visible_shadow = False

# ---------- camera path: the landing poses, 24 frames apart ----------
POSES = [  # name, pos, tgt, fov, roll  (must match KEYS in components/quiren/stage-seq.ts)
    ("hero", (0.35, -0.72, 5.0), (-0.05, -0.3, 0), 38, 0),
    ("manifesto", (-1.25, 0.35, 3.9), (0.15, 0.35, 0), 34, -0.03),
    ("partners", (0.25, -0.75, 3.3), (0.0, 0.05, 0), 36, 0.02),
    ("macro", (0.25, 0.1, 1.2), (-0.35, -0.02, 0), 38, 0.06),
    ("macroB", (0.55, 0.3, 1.1), (-0.3, 0.0, 0), 40, -0.08),
    ("macroC", (-0.15, -0.15, 1.15), (-0.45, 0.1, 0), 38, 0.1),
    ("final", (0.25, 0.85, 4.3), (0.05, 0.25, 0), 34, 0),
]
STEP = 20
cd = bpy.data.cameras.new("cam"); cam = link(bpy.data.objects.new("cam", cd)); sc.camera = cam
cd.sensor_fit = "VERTICAL"; cd.dof.use_dof = True; cd.dof.aperture_blades = 7
focus = link(bpy.data.objects.new("focus", None)); cd.dof.focus_object = focus

def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def pose_at(f):
    i = min(f // STEP, len(POSES) - 2); t = (f - i * STEP) / STEP
    if f >= (len(POSES) - 1) * STEP: i, t = len(POSES) - 2, 1.0
    a, b = POSES[i], POSES[i + 1]
    return lerp(a[1], b[1], t), lerp(a[2], b[2], t), a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t

import os
os.makedirs(OUT, exist_ok=True)
gem_c = P(0, 0.05, 0)
for f in (range(0, (len(POSES) - 1) * STEP + 1, STEP) if KEYS_ONLY else range(F0, F1 + 1)):
    pos, tgt, fov, roll = pose_at(f)
    cam.location = P(*pos)
    d = P(*tgt) - P(*pos)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); cam.rotation_euler.rotate_axis("Z", roll)
    cd.angle = math.radians(fov)
    # focus on the near face of the stone; wider shots get a deeper field
    dist = (gem_c - cam.location).length
    focus.location = cam.location + (gem_c - cam.location).normalized() * ((dist - 0.45) if dist > 3 else dist - 0.12)
    cd.dof.aperture_fstop = 0.75 if dist > 3 else 3.5
    # the cross turns inside the still ice as the page scrolls
    core.rotation_euler = (0.55 + f * math.tau * 0.35 / 120, 0.6, 0.4 + f * math.tau / 120)
    sc.render.filepath = f"{OUT}/f{f:03d}.png"
    bpy.ops.render.render(write_still=True)
    print("frame", f, flush=True)
