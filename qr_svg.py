"""Zero-dependency ISO/IEC 18004 QR Code (Byte mode, ECC Level M) SVG generator.

Generates crisp, phone-camera-scannable vector QR codes for Official CCRC Rider ID
verification links without relying on external APIs or third-party packages.
"""

from __future__ import annotations

# ISO/IEC 18004 Version 1..10 at Error Correction Level M (15% recovery)
# Tuple: (version, ec_cw_per_block, g1_blocks, g1_data_cw, g2_blocks, g2_data_cw)
_VERSION_SPECS_M: tuple[tuple[int, int, int, int, int, int], ...] = (
    (1, 10, 1, 16, 0, 0),
    (2, 16, 1, 28, 0, 0),
    (3, 26, 1, 44, 0, 0),
    (4, 18, 2, 32, 0, 0),
    (5, 24, 2, 43, 0, 0),
    (6, 16, 4, 27, 0, 0),
    (7, 18, 4, 31, 0, 0),
    (8, 22, 2, 38, 2, 39),
    (9, 22, 3, 36, 2, 37),
    (10, 26, 4, 43, 1, 44),
)

# ISO/IEC 18004 Annex E alignment pattern centers for Versions 1..10
_ALIGNMENT_CENTERS: dict[int, tuple[int, ...]] = {
    1: (),
    2: (6, 18),
    3: (6, 22),
    4: (6, 26),
    5: (6, 30),
    6: (6, 34),
    7: (6, 22, 38),
    8: (6, 24, 42),
    9: (6, 26, 46),
    10: (6, 28, 50),
}


# Precompute GF(256) log/exp tables with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
def _build_gf_tables() -> tuple[list[int], list[int]]:
    exp = [0] * 512
    log = [0] * 256
    val = 1
    for i in range(255):
        exp[i] = val
        log[val] = i
        val <<= 1
        if val & 0x100:
            val ^= 0x11D
    for i in range(255, 512):
        exp[i] = exp[i - 255]
    return exp, log


_GF_EXP, _GF_LOG = _build_gf_tables()


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]


def _rs_generator(degree: int) -> list[int]:
    poly = [1]
    for i in range(degree):
        factor = [1, _GF_EXP[i]]
        nxt = [0] * (len(poly) + 1)
        for j, a in enumerate(poly):
            for k, b in enumerate(factor):
                nxt[j + k] ^= _gf_mul(a, b)
        poly = nxt
    return poly


def _rs_remainder(data: list[int], ec_count: int) -> list[int]:
    gen = _rs_generator(ec_count)
    rem = [0] * ec_count
    for byte in data:
        factor = byte ^ rem[0]
        rem = rem[1:] + [0]
        if factor != 0:
            for i in range(ec_count):
                rem[i] ^= _gf_mul(gen[i + 1], factor)
    return rem


def _select_version_m(payload_len: int) -> tuple[int, int, int, int, int, int]:
    for spec in _VERSION_SPECS_M:
        ver, _ec, g1_b, g1_d, g2_b, g2_d = spec
        total_data_cw = g1_b * g1_d + g2_b * g2_d
        char_count_bits = 8 if ver <= 9 else 16
        # 4-bit mode indicator + char_count_bits + 8*payload_len must fit in total_data_cw*8 bits
        if 4 + char_count_bits + payload_len * 8 <= total_data_cw * 8:
            return spec
    raise ValueError("QR payload exceeds supported Version 10 Level M capacity (213 bytes).")


def _encode_codewords(payload: bytes, spec: tuple[int, int, int, int, int, int]) -> list[int]:
    ver, ec_cw, g1_b, g1_d, g2_b, g2_d = spec
    total_data_cw = g1_b * g1_d + g2_b * g2_d
    total_data_bits = total_data_cw * 8

    bits: list[int] = []

    def append_bits(value: int, width: int) -> None:
        for shift in range(width - 1, -1, -1):
            bits.append((value >> shift) & 1)

    # Byte mode indicator = 0100
    append_bits(0b0100, 4)
    append_bits(len(payload), 8 if ver <= 9 else 16)
    for b in payload:
        append_bits(b, 8)

    # Terminator (up to 4 zero bits)
    term_len = min(4, total_data_bits - len(bits))
    bits.extend([0] * term_len)

    # Pad to byte boundary
    while len(bits) % 8 != 0:
        bits.append(0)

    data_cw: list[int] = []
    for i in range(0, len(bits), 8):
        byte_val = 0
        for j in range(8):
            byte_val = (byte_val << 1) | bits[i + j]
        data_cw.append(byte_val)

    # Alternating pad bytes 0xEC, 0x11
    pad_bytes = (0xEC, 0x11)
    pad_idx = 0
    while len(data_cw) < total_data_cw:
        data_cw.append(pad_bytes[pad_idx])
        pad_idx ^= 1

    # Split into blocks and compute Reed-Solomon ECC for each block
    data_blocks: list[list[int]] = []
    ec_blocks: list[list[int]] = []
    offset = 0
    for _ in range(g1_b):
        blk = data_cw[offset : offset + g1_d]
        offset += g1_d
        data_blocks.append(blk)
        ec_blocks.append(_rs_remainder(blk, ec_cw))
    for _ in range(g2_b):
        blk = data_cw[offset : offset + g2_d]
        offset += g2_d
        data_blocks.append(blk)
        ec_blocks.append(_rs_remainder(blk, ec_cw))

    # Interleave data codewords, then ECC codewords
    interleaved: list[int] = []
    max_data_len = max(len(b) for b in data_blocks)
    for col in range(max_data_len):
        for blk in data_blocks:
            if col < len(blk):
                interleaved.append(blk[col])
    for col in range(ec_cw):
        for blk in ec_blocks:
            interleaved.append(blk[col])

    return interleaved


def _place_function_patterns(version: int) -> tuple[list[list[bool]], list[list[bool]]]:
    size = 17 + 4 * version
    modules = [[False] * size for _ in range(size)]
    is_func = [[False] * size for _ in range(size)]

    def set_func(r: int, c: int, dark: bool) -> None:
        if 0 <= r < size and 0 <= c < size:
            modules[r][c] = dark
            is_func[r][c] = True

    # 1. Finder patterns (7x7) + 1-module white separator
    def draw_finder(top: int, left: int) -> None:
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                r, c = top + dr, left + dc
                if 0 <= r < size and 0 <= c < size:
                    in_outer = 0 <= dr <= 6 and 0 <= dc <= 6
                    on_border = dr in (0, 6) or dc in (0, 6)
                    in_center = 2 <= dr <= 4 and 2 <= dc <= 4
                    set_func(r, c, in_outer and (on_border or in_center))

    draw_finder(0, 0)
    draw_finder(0, size - 7)
    draw_finder(size - 7, 0)

    # 2. Timing patterns (row 6 and col 6)
    for i in range(8, size - 8):
        dark = (i % 2 == 0)
        set_func(6, i, dark)
        set_func(i, 6, dark)

    # 3. Alignment patterns (5x5)
    centers = _ALIGNMENT_CENTERS[version]
    for r in centers:
        for c in centers:
            # Skip positions overlapping the 3 finder patterns
            if (r <= 8 and c <= 8) or (r <= 8 and c >= size - 8) or (r >= size - 8 and c <= 8):
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    dark = max(abs(dr), abs(dc)) != 1
                    set_func(r + dr, c + dc, dark)

    # 4. Reserve format information cells + dark module
    for i in range(9):
        if i != 6:
            is_func[8][i] = True
            is_func[i][8] = True
    for i in range(size - 8, size):
        is_func[8][i] = True
    for i in range(size - 7, size):
        is_func[i][8] = True
    set_func(4 * version + 9, 8, True)

    # 5. Version information cells (versions >= 7)
    if version >= 7:
        vinfo = version << 12
        rem = vinfo
        for shift in range(5, -1, -1):
            if rem & (1 << (shift + 12)):
                rem ^= 0x1F25 << shift
        vbits = vinfo | rem
        for i in range(18):
            dark = bool((vbits >> i) & 1)
            a = i // 3
            b = size - 11 + (i % 3)
            set_func(a, b, dark)
            set_func(b, a, dark)

    return modules, is_func


def _format_bits_m(mask: int) -> int:
    # Level M indicator = 0b00, followed by 3-bit mask ID
    data = (0b00 << 3) | (mask & 0b111)
    rem = data << 10
    for shift in range(4, -1, -1):
        if rem & (1 << (shift + 10)):
            rem ^= 0x537 << shift
    return ((data << 10) | rem) ^ 0x5412


def _write_format_bits(modules: list[list[bool]], mask: int) -> None:
    size = len(modules)
    fmt = _format_bits_m(mask)

    # Copy 1 around top-left finder
    top_left_coords = (
        (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5),
        (8, 7), (8, 8), (7, 8),
        (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
    )
    for idx, (r, c) in enumerate(top_left_coords):
        modules[r][c] = bool((fmt >> (14 - idx)) & 1)

    # Copy 2 along bottom-left (bits 14..8) and top-right (bits 7..0)
    for idx in range(7):
        modules[size - 1 - idx][8] = bool((fmt >> (14 - idx)) & 1)
    for idx in range(8):
        modules[8][size - 8 + idx] = bool((fmt >> (7 - idx)) & 1)


def _mask_condition(mask: int, r: int, c: int) -> bool:
    if mask == 0:
        return (r + c) % 2 == 0
    if mask == 1:
        return r % 2 == 0
    if mask == 2:
        return c % 3 == 0
    if mask == 3:
        return (r + c) % 3 == 0
    if mask == 4:
        return ((r // 2) + (c // 3)) % 2 == 0
    if mask == 5:
        return ((r * c) % 2) + ((r * c) % 3) == 0
    if mask == 6:
        return (((r * c) % 2) + ((r * c) % 3)) % 2 == 0
    return (((r + c) % 2) + ((r * c) % 3)) % 2 == 0


def _penalty_score(modules: list[list[bool]]) -> int:
    size = len(modules)
    penalty = 0

    # Rule 1: runs of 5+ same-color modules in rows and columns
    for r in range(size):
        run_color = modules[r][0]
        run_len = 1
        for c in range(1, size):
            if modules[r][c] == run_color:
                run_len += 1
            else:
                if run_len >= 5:
                    penalty += 3 + (run_len - 5)
                run_color = modules[r][c]
                run_len = 1
        if run_len >= 5:
            penalty += 3 + (run_len - 5)

    for c in range(size):
        run_color = modules[0][c]
        run_len = 1
        for r in range(1, size):
            if modules[r][c] == run_color:
                run_len += 1
            else:
                if run_len >= 5:
                    penalty += 3 + (run_len - 5)
                run_color = modules[r][c]
                run_len = 1
        if run_len >= 5:
            penalty += 3 + (run_len - 5)

    # Rule 2: 2x2 blocks of same color
    for r in range(size - 1):
        row0 = modules[r]
        row1 = modules[r + 1]
        for c in range(size - 1):
            col = row0[c]
            if col == row0[c + 1] == row1[c] == row1[c + 1]:
                penalty += 3

    # Rule 3: finder-like 1:1:3:1:1 patterns with 4 light modules on either side
    pat1 = (True, False, True, True, True, False, True, False, False, False, False)
    pat2 = (False, False, False, False, True, False, True, True, True, False, True)
    for r in range(size):
        row = modules[r]
        for c in range(size - 10):
            seg = tuple(row[c : c + 11])
            if seg == pat1 or seg == pat2:
                penalty += 40
    for c in range(size):
        for r in range(size - 10):
            seg = tuple(modules[r + k][c] for k in range(11))
            if seg == pat1 or seg == pat2:
                penalty += 40

    # Rule 4: dark/light balance
    dark_count = sum(1 for row in modules for cell in row if cell)
    total = size * size
    k = abs(dark_count * 20 - total * 10) // total
    penalty += k * 10

    return penalty


def make_qr_matrix(data: str | bytes) -> list[list[bool]]:
    """Build a standard ISO/IEC 18004 QR Code boolean matrix (ECC Level M)."""
    payload = data.encode("utf-8") if isinstance(data, str) else bytes(data)
    spec = _select_version_m(len(payload))
    version = spec[0]
    codewords = _encode_codewords(payload, spec)

    base_modules, is_func = _place_function_patterns(version)
    size = len(base_modules)

    # Place data bits in 2-column zigzag from bottom-right upward, skipping col 6
    bit_stream: list[bool] = []
    for cw in codewords:
        for shift in range(7, -1, -1):
            bit_stream.append(bool((cw >> shift) & 1))

    bit_idx = 0
    upward = True
    col = size - 1
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(size - 1, -1, -1) if upward else range(size)
        for r in rows:
            for dc in (0, -1):
                c = col + dc
                if not is_func[r][c]:
                    base_modules[r][c] = bit_stream[bit_idx] if bit_idx < len(bit_stream) else False
                    bit_idx += 1
        upward = not upward
        col -= 2

    # Evaluate all 8 masks and pick the lowest penalty matrix
    best_matrix: list[list[bool]] | None = None
    best_penalty = 1 << 30
    for mask in range(8):
        cand = [row[:] for row in base_modules]
        for r in range(size):
            for c in range(size):
                if not is_func[r][c] and _mask_condition(mask, r, c):
                    cand[r][c] = not cand[r][c]
        _write_format_bits(cand, mask)
        score = _penalty_score(cand)
        if score < best_penalty:
            best_penalty = score
            best_matrix = cand

    assert best_matrix is not None
    return best_matrix


def render_qr_svg(
    data: str | bytes,
    border: int = 4,
    dark: str = "#0f172a",
    light: str = "#ffffff",
) -> str:
    """Render a crisp, scannable vector SVG QR code."""
    matrix = make_qr_matrix(data)
    size = len(matrix)
    dim = size + 2 * border

    # Combine horizontal runs into compact SVG subpaths
    path_parts: list[str] = []
    for r, row in enumerate(matrix):
        y = r + border
        c = 0
        while c < size:
            if row[c]:
                start = c
                while c < size and row[c]:
                    c += 1
                width = c - start
                path_parts.append(f"M{start + border} {y}h{width}v1h-{width}z")
            else:
                c += 1

    path_d = "".join(path_parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {dim} {dim}" '
        f'width="100%" height="100%" shape-rendering="crispEdges" role="img" '
        f'aria-label="Official CCRC Rider Verification QR Code">'
        f'<rect width="{dim}" height="{dim}" fill="{light}"/>'
        f'<path d="{path_d}" fill="{dark}"/>'
        f"</svg>"
    )
