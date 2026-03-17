function Co(e) {
    for (let t = 0; t < e.length; t++)
        e[t] = 0;
    return e
}

function _o(e, t=new Uint8Array(4), n=0) {
    return t[n + 0] = e >>> 0,
        t[n + 1] = e >>> 8,
        t[n + 2] = e >>> 16,
        t[n + 3] = e >>> 24,
        t
}

function Do(e, t, n) {
    let a = 1634760805
        , o = 857760878
        , r = 2036477234
        , s = 1797285236
        , i = e[3] << 24 | e[2] << 16 | e[1] << 8 | e[0]
        , l = e[7] << 24 | e[6] << 16 | e[5] << 8 | e[4]
        , c = e[11] << 24 | e[10] << 16 | e[9] << 8 | e[8]
        , u = e[15] << 24 | e[14] << 16 | e[13] << 8 | e[12]
        , d = e[19] << 24 | e[18] << 16 | e[17] << 8 | e[16]
        , f = e[23] << 24 | e[22] << 16 | e[21] << 8 | e[20]
        , v = e[27] << 24 | e[26] << 16 | e[25] << 8 | e[24]
        , p = e[31] << 24 | e[30] << 16 | e[29] << 8 | e[28]
        , h = t[3] << 24 | t[2] << 16 | t[1] << 8 | t[0]
        , m = t[7] << 24 | t[6] << 16 | t[5] << 8 | t[4]
        , y = t[11] << 24 | t[10] << 16 | t[9] << 8 | t[8]
        , g = t[15] << 24 | t[14] << 16 | t[13] << 8 | t[12];
    for (let k = 0; k < 20; k += 2)
        a = a + i | 0,
            h ^= a,
            h = h >>> 16 | h << 16,
            d = d + h | 0,
            i ^= d,
            i = i >>> 20 | i << 12,
            o = o + l | 0,
            m ^= o,
            m = m >>> 16 | m << 16,
            f = f + m | 0,
            l ^= f,
            l = l >>> 20 | l << 12,
            r = r + c | 0,
            y ^= r,
            y = y >>> 16 | y << 16,
            v = v + y | 0,
            c ^= v,
            c = c >>> 20 | c << 12,
            s = s + u | 0,
            g ^= s,
            g = g >>> 16 | g << 16,
            p = p + g | 0,
            u ^= p,
            u = u >>> 20 | u << 12,
            r = r + c | 0,
            y ^= r,
            y = y >>> 24 | y << 8,
            v = v + y | 0,
            c ^= v,
            c = c >>> 25 | c << 7,
            s = s + u | 0,
            g ^= s,
            g = g >>> 24 | g << 8,
            p = p + g | 0,
            u ^= p,
            u = u >>> 25 | u << 7,
            o = o + l | 0,
            m ^= o,
            m = m >>> 24 | m << 8,
            f = f + m | 0,
            l ^= f,
            l = l >>> 25 | l << 7,
            a = a + i | 0,
            h ^= a,
            h = h >>> 24 | h << 8,
            d = d + h | 0,
            i ^= d,
            i = i >>> 25 | i << 7,
            a = a + l | 0,
            g ^= a,
            g = g >>> 16 | g << 16,
            v = v + g | 0,
            l ^= v,
            l = l >>> 20 | l << 12,
            o = o + c | 0,
            h ^= o,
            h = h >>> 16 | h << 16,
            p = p + h | 0,
            c ^= p,
            c = c >>> 20 | c << 12,
            r = r + u | 0,
            m ^= r,
            m = m >>> 16 | m << 16,
            d = d + m | 0,
            u ^= d,
            u = u >>> 20 | u << 12,
            s = s + i | 0,
            y ^= s,
            y = y >>> 16 | y << 16,
            f = f + y | 0,
            i ^= f,
            i = i >>> 20 | i << 12,
            r = r + u | 0,
            m ^= r,
            m = m >>> 24 | m << 8,
            d = d + m | 0,
            u ^= d,
            u = u >>> 25 | u << 7,
            s = s + i | 0,
            y ^= s,
            y = y >>> 24 | y << 8,
            f = f + y | 0,
            i ^= f,
            i = i >>> 25 | i << 7,
            o = o + c | 0,
            h ^= o,
            h = h >>> 24 | h << 8,
            p = p + h | 0,
            c ^= p,
            c = c >>> 25 | c << 7,
            a = a + l | 0,
            g ^= a,
            g = g >>> 24 | g << 8,
            v = v + g | 0,
            l ^= v,
            l = l >>> 25 | l << 7;
    return _o(a, n, 0),
        _o(o, n, 4),
        _o(r, n, 8),
        _o(s, n, 12),
        _o(h, n, 16),
        _o(m, n, 20),
        _o(y, n, 24),
        _o(g, n, 28),
        n
}

class Po {
    nonceLength = 24;
    tagLength = 16;
    _key;
    constructor(e) {
        if (32 !== e.length)
            throw new Error("ChaCha20Poly1305 needs 32-byte key");
        this._key = new Uint8Array(e)
    }
    seal(e, t, n, a) {
        if (24 !== e.length)
            throw new Error("XChaCha20Poly1305: incorrect nonce length");
        const o = Do(this._key, e.subarray(0, 16), new Uint8Array(32))
            , r = new Uint8Array(12);
        r.set(e.subarray(16), 4);
        const s = new jo(o)
            , i = s.seal(r, t, n, a);
        return Co(o),
            Co(r),
            s.clean(),
            i
    }
    open(e, t, n, a) {
        if (24 !== e.length)
            throw new Error("XChaCha20Poly1305: incorrect nonce length");
        if (t.length < this.tagLength)
            return null;
        const o = Do(this._key, e.subarray(0, 16), new Uint8Array(32))
            , r = new Uint8Array(12);
        r.set(e.subarray(16), 4);
        const s = new jo(o)
            , i = s.open(r, t, n, a);
        return Co(o),
            Co(r),
            s.clean(),
            i
    }
    clean() {
        return Co(this._key),
            this
    }
}

function So(e, t, n, a, o=0) {
    if (32 !== e.length)
        throw new Error("ChaCha: key size must be 32 bytes");
    if (a.length < n.length)
        throw new Error("ChaCha: destination is shorter than source");
    let r, s;
    if (0 === o) {
        if (8 !== t.length && 12 !== t.length)
            throw new Error("ChaCha nonce must be 8 or 12 bytes");
        r = new Uint8Array(16),
            s = r.length - t.length,
            r.set(t, s)
    } else {
        if (16 !== t.length)
            throw new Error("ChaCha nonce with counter must be 16 bytes");
        r = t,
            s = o
    }
    const i = new Uint8Array(64);
    for (let l = 0; l < n.length; l += 64) {
        Lo(i, r, e);
        for (let e = l; e < l + 64 && e < n.length; e++)
            a[e] = n[e] ^ i[e - l];
        Ao(r, 0, s)
    }
    return Co(i),
    0 === o && Co(r),
        a
}

function Ao(e, t, n) {
    let a = 1;
    for (; n--; )
        a = a + (255 & e[t]) | 0,
            e[t] = 255 & a,
            a >>>= 8,
            t++;
    if (a > 0)
        throw new Error("ChaCha: counter overflow")
}

function Lo(e, t, n) {
    let a = 1634760805
        , o = 857760878
        , r = 2036477234
        , s = 1797285236
        , i = n[3] << 24 | n[2] << 16 | n[1] << 8 | n[0]
        , l = n[7] << 24 | n[6] << 16 | n[5] << 8 | n[4]
        , c = n[11] << 24 | n[10] << 16 | n[9] << 8 | n[8]
        , u = n[15] << 24 | n[14] << 16 | n[13] << 8 | n[12]
        , d = n[19] << 24 | n[18] << 16 | n[17] << 8 | n[16]
        , f = n[23] << 24 | n[22] << 16 | n[21] << 8 | n[20]
        , v = n[27] << 24 | n[26] << 16 | n[25] << 8 | n[24]
        , p = n[31] << 24 | n[30] << 16 | n[29] << 8 | n[28]
        , h = t[3] << 24 | t[2] << 16 | t[1] << 8 | t[0]
        , m = t[7] << 24 | t[6] << 16 | t[5] << 8 | t[4]
        , y = t[11] << 24 | t[10] << 16 | t[9] << 8 | t[8]
        , g = t[15] << 24 | t[14] << 16 | t[13] << 8 | t[12]
        , k = a
        , b = o
        , w = r
        , _ = s
        , x = i
        , C = l
        , L = c
        , S = u
        , M = d
        , A = f
        , D = v
        , E = p
        , I = h
        , j = m
        , P = y
        , T = g;
    for (let R = 0; R < 20; R += 2)
        k = k + x | 0,
            I ^= k,
            I = I >>> 16 | I << 16,
            M = M + I | 0,
            x ^= M,
            x = x >>> 20 | x << 12,
            b = b + C | 0,
            j ^= b,
            j = j >>> 16 | j << 16,
            A = A + j | 0,
            C ^= A,
            C = C >>> 20 | C << 12,
            w = w + L | 0,
            P ^= w,
            P = P >>> 16 | P << 16,
            D = D + P | 0,
            L ^= D,
            L = L >>> 20 | L << 12,
            _ = _ + S | 0,
            T ^= _,
            T = T >>> 16 | T << 16,
            E = E + T | 0,
            S ^= E,
            S = S >>> 20 | S << 12,
            w = w + L | 0,
            P ^= w,
            P = P >>> 24 | P << 8,
            D = D + P | 0,
            L ^= D,
            L = L >>> 25 | L << 7,
            _ = _ + S | 0,
            T ^= _,
            T = T >>> 24 | T << 8,
            E = E + T | 0,
            S ^= E,
            S = S >>> 25 | S << 7,
            b = b + C | 0,
            j ^= b,
            j = j >>> 24 | j << 8,
            A = A + j | 0,
            C ^= A,
            C = C >>> 25 | C << 7,
            k = k + x | 0,
            I ^= k,
            I = I >>> 24 | I << 8,
            M = M + I | 0,
            x ^= M,
            x = x >>> 25 | x << 7,
            k = k + C | 0,
            T ^= k,
            T = T >>> 16 | T << 16,
            D = D + T | 0,
            C ^= D,
            C = C >>> 20 | C << 12,
            b = b + L | 0,
            I ^= b,
            I = I >>> 16 | I << 16,
            E = E + I | 0,
            L ^= E,
            L = L >>> 20 | L << 12,
            w = w + S | 0,
            j ^= w,
            j = j >>> 16 | j << 16,
            M = M + j | 0,
            S ^= M,
            S = S >>> 20 | S << 12,
            _ = _ + x | 0,
            P ^= _,
            P = P >>> 16 | P << 16,
            A = A + P | 0,
            x ^= A,
            x = x >>> 20 | x << 12,
            w = w + S | 0,
            j ^= w,
            j = j >>> 24 | j << 8,
            M = M + j | 0,
            S ^= M,
            S = S >>> 25 | S << 7,
            _ = _ + x | 0,
            P ^= _,
            P = P >>> 24 | P << 8,
            A = A + P | 0,
            x ^= A,
            x = x >>> 25 | x << 7,
            b = b + L | 0,
            I ^= b,
            I = I >>> 24 | I << 8,
            E = E + I | 0,
            L ^= E,
            L = L >>> 25 | L << 7,
            k = k + C | 0,
            T ^= k,
            T = T >>> 24 | T << 8,
            D = D + T | 0,
            C ^= D,
            C = C >>> 25 | C << 7;
    _o(k + a | 0, e, 0),
        _o(b + o | 0, e, 4),
        _o(w + r | 0, e, 8),
        _o(_ + s | 0, e, 12),
        _o(x + i | 0, e, 16),
        _o(C + l | 0, e, 20),
        _o(L + c | 0, e, 24),
        _o(S + u | 0, e, 28),
        _o(M + d | 0, e, 32),
        _o(A + f | 0, e, 36),
        _o(D + v | 0, e, 40),
        _o(E + p | 0, e, 44),
        _o(I + h | 0, e, 48),
        _o(j + m | 0, e, 52),
        _o(P + y | 0, e, 56),
        _o(T + g | 0, e, 60)
}

class Eo {
    digestLength = 16;
    _buffer = new Uint8Array(16);
    _r = new Uint16Array(10);
    _h = new Uint16Array(10);
    _pad = new Uint16Array(8);
    _leftover = 0;
    _fin = 0;
    _finished = !1;
    constructor(e) {
        let t = e[0] | e[1] << 8;
        this._r[0] = 8191 & t;
        let n = e[2] | e[3] << 8;
        this._r[1] = 8191 & (t >>> 13 | n << 3);
        let a = e[4] | e[5] << 8;
        this._r[2] = 7939 & (n >>> 10 | a << 6);
        let o = e[6] | e[7] << 8;
        this._r[3] = 8191 & (a >>> 7 | o << 9);
        let r = e[8] | e[9] << 8;
        this._r[4] = 255 & (o >>> 4 | r << 12),
            this._r[5] = r >>> 1 & 8190;
        let s = e[10] | e[11] << 8;
        this._r[6] = 8191 & (r >>> 14 | s << 2);
        let i = e[12] | e[13] << 8;
        this._r[7] = 8065 & (s >>> 11 | i << 5);
        let l = e[14] | e[15] << 8;
        this._r[8] = 8191 & (i >>> 8 | l << 8),
            this._r[9] = l >>> 5 & 127,
            this._pad[0] = e[16] | e[17] << 8,
            this._pad[1] = e[18] | e[19] << 8,
            this._pad[2] = e[20] | e[21] << 8,
            this._pad[3] = e[22] | e[23] << 8,
            this._pad[4] = e[24] | e[25] << 8,
            this._pad[5] = e[26] | e[27] << 8,
            this._pad[6] = e[28] | e[29] << 8,
            this._pad[7] = e[30] | e[31] << 8
    }
    _blocks(e, t, n) {
        let a = this._fin ? 0 : 2048
            , o = this._h[0]
            , r = this._h[1]
            , s = this._h[2]
            , i = this._h[3]
            , l = this._h[4]
            , c = this._h[5]
            , u = this._h[6]
            , d = this._h[7]
            , f = this._h[8]
            , v = this._h[9]
            , p = this._r[0]
            , h = this._r[1]
            , m = this._r[2]
            , y = this._r[3]
            , g = this._r[4]
            , k = this._r[5]
            , b = this._r[6]
            , w = this._r[7]
            , _ = this._r[8]
            , x = this._r[9];
        for (; n >= 16; ) {
            let C = e[t + 0] | e[t + 1] << 8;
            o += 8191 & C;
            let L = e[t + 2] | e[t + 3] << 8;
            r += 8191 & (C >>> 13 | L << 3);
            let S = e[t + 4] | e[t + 5] << 8;
            s += 8191 & (L >>> 10 | S << 6);
            let M = e[t + 6] | e[t + 7] << 8;
            i += 8191 & (S >>> 7 | M << 9);
            let A = e[t + 8] | e[t + 9] << 8;
            l += 8191 & (M >>> 4 | A << 12),
                c += A >>> 1 & 8191;
            let D = e[t + 10] | e[t + 11] << 8;
            u += 8191 & (A >>> 14 | D << 2);
            let E = e[t + 12] | e[t + 13] << 8;
            d += 8191 & (D >>> 11 | E << 5);
            let I = e[t + 14] | e[t + 15] << 8;
            f += 8191 & (E >>> 8 | I << 8),
                v += I >>> 5 | a;
            let j = 0
                , P = j;
            P += o * p,
                P += r * (5 * x),
                P += s * (5 * _),
                P += i * (5 * w),
                P += l * (5 * b),
                j = P >>> 13,
                P &= 8191,
                P += c * (5 * k),
                P += u * (5 * g),
                P += d * (5 * y),
                P += f * (5 * m),
                P += v * (5 * h),
                j += P >>> 13,
                P &= 8191;
            let T = j;
            T += o * h,
                T += r * p,
                T += s * (5 * x),
                T += i * (5 * _),
                T += l * (5 * w),
                j = T >>> 13,
                T &= 8191,
                T += c * (5 * b),
                T += u * (5 * k),
                T += d * (5 * g),
                T += f * (5 * y),
                T += v * (5 * m),
                j += T >>> 13,
                T &= 8191;
            let R = j;
            R += o * m,
                R += r * h,
                R += s * p,
                R += i * (5 * x),
                R += l * (5 * _),
                j = R >>> 13,
                R &= 8191,
                R += c * (5 * w),
                R += u * (5 * b),
                R += d * (5 * k),
                R += f * (5 * g),
                R += v * (5 * y),
                j += R >>> 13,
                R &= 8191;
            let B = j;
            B += o * y,
                B += r * m,
                B += s * h,
                B += i * p,
                B += l * (5 * x),
                j = B >>> 13,
                B &= 8191,
                B += c * (5 * _),
                B += u * (5 * w),
                B += d * (5 * b),
                B += f * (5 * k),
                B += v * (5 * g),
                j += B >>> 13,
                B &= 8191;
            let O = j;
            O += o * g,
                O += r * y,
                O += s * m,
                O += i * h,
                O += l * p,
                j = O >>> 13,
                O &= 8191,
                O += c * (5 * x),
                O += u * (5 * _),
                O += d * (5 * w),
                O += f * (5 * b),
                O += v * (5 * k),
                j += O >>> 13,
                O &= 8191;
            let U = j;
            U += o * k,
                U += r * g,
                U += s * y,
                U += i * m,
                U += l * h,
                j = U >>> 13,
                U &= 8191,
                U += c * p,
                U += u * (5 * x),
                U += d * (5 * _),
                U += f * (5 * w),
                U += v * (5 * b),
                j += U >>> 13,
                U &= 8191;
            let W = j;
            W += o * b,
                W += r * k,
                W += s * g,
                W += i * y,
                W += l * m,
                j = W >>> 13,
                W &= 8191,
                W += c * h,
                W += u * p,
                W += d * (5 * x),
                W += f * (5 * _),
                W += v * (5 * w),
                j += W >>> 13,
                W &= 8191;
            let H = j;
            H += o * w,
                H += r * b,
                H += s * k,
                H += i * g,
                H += l * y,
                j = H >>> 13,
                H &= 8191,
                H += c * m,
                H += u * h,
                H += d * p,
                H += f * (5 * x),
                H += v * (5 * _),
                j += H >>> 13,
                H &= 8191;
            let N = j;
            N += o * _,
                N += r * w,
                N += s * b,
                N += i * k,
                N += l * g,
                j = N >>> 13,
                N &= 8191,
                N += c * y,
                N += u * m,
                N += d * h,
                N += f * p,
                N += v * (5 * x),
                j += N >>> 13,
                N &= 8191;
            let V = j;
            V += o * x,
                V += r * _,
                V += s * w,
                V += i * b,
                V += l * k,
                j = V >>> 13,
                V &= 8191,
                V += c * g,
                V += u * y,
                V += d * m,
                V += f * h,
                V += v * p,
                j += V >>> 13,
                V &= 8191,
                j = (j << 2) + j | 0,
                j = j + P | 0,
                P = 8191 & j,
                j >>>= 13,
                T += j,
                o = P,
                r = T,
                s = R,
                i = B,
                l = O,
                c = U,
                u = W,
                d = H,
                f = N,
                v = V,
                t += 16,
                n -= 16
        }
        this._h[0] = o,
            this._h[1] = r,
            this._h[2] = s,
            this._h[3] = i,
            this._h[4] = l,
            this._h[5] = c,
            this._h[6] = u,
            this._h[7] = d,
            this._h[8] = f,
            this._h[9] = v
    }
    finish(e, t=0) {
        const n = new Uint16Array(10);
        let a, o, r, s;
        if (this._leftover) {
            for (s = this._leftover,
                     this._buffer[s++] = 1; s < 16; s++)
                this._buffer[s] = 0;
            this._fin = 1,
                this._blocks(this._buffer, 0, 16)
        }
        for (a = this._h[1] >>> 13,
                 this._h[1] &= 8191,
                 s = 2; s < 10; s++)
            this._h[s] += a,
                a = this._h[s] >>> 13,
                this._h[s] &= 8191;
        for (this._h[0] += 5 * a,
                 a = this._h[0] >>> 13,
                 this._h[0] &= 8191,
                 this._h[1] += a,
                 a = this._h[1] >>> 13,
                 this._h[1] &= 8191,
                 this._h[2] += a,
                 n[0] = this._h[0] + 5,
                 a = n[0] >>> 13,
                 n[0] &= 8191,
                 s = 1; s < 10; s++)
            n[s] = this._h[s] + a,
                a = n[s] >>> 13,
                n[s] &= 8191;
        for (n[9] -= 8192,
                 o = (1 ^ a) - 1,
                 s = 0; s < 10; s++)
            n[s] &= o;
        for (o = ~o,
                 s = 0; s < 10; s++)
            this._h[s] = this._h[s] & o | n[s];
        for (this._h[0] = 65535 & (this._h[0] | this._h[1] << 13),
                 this._h[1] = 65535 & (this._h[1] >>> 3 | this._h[2] << 10),
                 this._h[2] = 65535 & (this._h[2] >>> 6 | this._h[3] << 7),
                 this._h[3] = 65535 & (this._h[3] >>> 9 | this._h[4] << 4),
                 this._h[4] = 65535 & (this._h[4] >>> 12 | this._h[5] << 1 | this._h[6] << 14),
                 this._h[5] = 65535 & (this._h[6] >>> 2 | this._h[7] << 11),
                 this._h[6] = 65535 & (this._h[7] >>> 5 | this._h[8] << 8),
                 this._h[7] = 65535 & (this._h[8] >>> 8 | this._h[9] << 5),
                 r = this._h[0] + this._pad[0],
                 this._h[0] = 65535 & r,
                 s = 1; s < 8; s++)
            r = (this._h[s] + this._pad[s] | 0) + (r >>> 16) | 0,
                this._h[s] = 65535 & r;
        return e[t + 0] = this._h[0] >>> 0,
            e[t + 1] = this._h[0] >>> 8,
            e[t + 2] = this._h[1] >>> 0,
            e[t + 3] = this._h[1] >>> 8,
            e[t + 4] = this._h[2] >>> 0,
            e[t + 5] = this._h[2] >>> 8,
            e[t + 6] = this._h[3] >>> 0,
            e[t + 7] = this._h[3] >>> 8,
            e[t + 8] = this._h[4] >>> 0,
            e[t + 9] = this._h[4] >>> 8,
            e[t + 10] = this._h[5] >>> 0,
            e[t + 11] = this._h[5] >>> 8,
            e[t + 12] = this._h[6] >>> 0,
            e[t + 13] = this._h[6] >>> 8,
            e[t + 14] = this._h[7] >>> 0,
            e[t + 15] = this._h[7] >>> 8,
            this._finished = !0,
            this
    }
    update(e) {
        let t, n = 0, a = e.length;
        if (this._leftover) {
            t = 16 - this._leftover,
            t > a && (t = a);
            for (let a = 0; a < t; a++)
                this._buffer[this._leftover + a] = e[n + a];
            if (a -= t,
                n += t,
                this._leftover += t,
            this._leftover < 16)
                return this;
            this._blocks(this._buffer, 0, 16),
                this._leftover = 0
        }
        if (a >= 16 && (t = a - a % 16,
            this._blocks(e, n, t),
            n += t,
            a -= t),
            a) {
            for (let t = 0; t < a; t++)
                this._buffer[this._leftover + t] = e[n + t];
            this._leftover += a
        }
        return this
    }
    digest() {
        if (this._finished)
            throw new Error("Poly1305 was finished");
        let e = new Uint8Array(16);
        return this.finish(e),
            e
    }
    clean() {
        return Co(this._buffer),
            Co(this._r),
            Co(this._h),
            Co(this._pad),
            this._leftover = 0,
            this._fin = 0,
            this._finished = !0,
            this
    }
}

function Mo(e, t, n, a=0) {
    return Co(n),
        So(e, t, n, n, a)
}

function xo(e, t=new Uint8Array(8), n=0) {
    return _o(e >>> 0, t, n),
        _o(e / 4294967296 >>> 0, t, n + 4),
        t
}

const Io = new Uint8Array(16);

class jo {
    nonceLength = 12;
    tagLength = 16;
    _key;
    constructor(e) {
        if (32 !== e.length)
            throw new Error("ChaCha20Poly1305 needs 32-byte key");
        this._key = new Uint8Array(e)
    }
    seal(e, t, n, a) {
        if (e.length > 16)
            throw new Error("ChaCha20Poly1305: incorrect nonce length");
        const o = new Uint8Array(16);
        o.set(e, o.length - e.length);
        const r = new Uint8Array(32);
        Mo(this._key, o, r, 4);
        const s = t.length + this.tagLength;
        let i;
        if (a) {
            if (a.length !== s)
                throw new Error("ChaCha20Poly1305: incorrect destination length");
            i = a
        } else
            i = new Uint8Array(s);
        return So(this._key, o, t, i, 4),
            this._authenticate(i.subarray(i.length - this.tagLength, i.length), r, i.subarray(0, i.length - this.tagLength), n),
            Co(o),
            i
    }
    open(e, t, n, a) {
        if (e.length > 16)
            throw new Error("ChaCha20Poly1305: incorrect nonce length");
        if (t.length < this.tagLength)
            return null;
        const o = new Uint8Array(16);
        o.set(e, o.length - e.length);
        const r = new Uint8Array(32);
        Mo(this._key, o, r, 4);
        const s = new Uint8Array(this.tagLength);
        if (this._authenticate(s, r, t.subarray(0, t.length - this.tagLength), n),
            i = s,
            l = t.subarray(t.length - this.tagLength, t.length),
        0 === i.length || 0 === l.length || 0 === function(e, t) {
            if (e.length !== t.length)
                return 0;
            let n = 0;
            for (let a = 0; a < e.length; a++)
                n |= e[a] ^ t[a];
            return 1 & n - 1 >>> 8
        }(i, l))
            return null;
        var i, l;
        const c = t.length - this.tagLength;
        let u;
        if (a) {
            if (a.length !== c)
                throw new Error("ChaCha20Poly1305: incorrect destination length");
            u = a
        } else
            u = new Uint8Array(c);
        return So(this._key, o, t.subarray(0, t.length - this.tagLength), u, 4),
            Co(o),
            u
    }
    clean() {
        return Co(this._key),
            this
    }
    _authenticate(e, t, n, a) {
        const o = new Eo(t);
        a && (o.update(a),
        a.length % 16 > 0 && o.update(Io.subarray(a.length % 16))),
            o.update(n),
        n.length % 16 > 0 && o.update(Io.subarray(n.length % 16));
        const r = new Uint8Array(8);
        a && xo(a.length, r),
            o.update(r),
            xo(n.length, r),
            o.update(r);
        const s = o.digest();
        for (let i = 0; i < s.length; i++)
            e[i] = s[i];
        o.clean(),
            Co(s),
            Co(r)
    }
}


function Uo(e) {
    const t = new Uint8Array(e.length / 2);
    for (let n = 0; n < t.length; n++)
        t[n] = parseInt(e.slice(2 * n, 2 * n + 2), 16);
    return t
}

function decryptResponse(e, t, n=1) {
    if (32 !== t.length)
        throw new Error("密钥长度必须为32字节");
    if (e.length < 41)
        throw new Error("密文长度不足");
    const a = e[0]
        , o = e.subarray(1, 25)
        , r = e.subarray(25)
        , s = 2 === a ? r.slice().reverse() : r
        , i = new Po(t).open(o, s);
    if (!i)
        throw new Error("认证失败");
    return i
}

async function encryptRequest(e, t, n=1) {
    if (32 !== t.length)
        throw new Error("密钥长度必须为32字节");
    const a = new Uint8Array(12);
    globalThis.crypto.getRandomValues(a);
    const o = {
        name: "AES-GCM",
        iv: a
    }
        , r = await crypto.subtle.importKey("raw", t, "AES-GCM", !1, ["encrypt"])
        , s = new Uint8Array(await crypto.subtle.encrypt(o, r, e));
    2 === n && function(e) {
        for (let t = 0, n = e.length - 1; t < n; t++,
            n--) {
            const a = e[t];
            e[t] = e[n],
                e[n] = a
        }
    }(s);
    const i = new Uint8Array(1 + a.length + s.length);
    return i[0] = 2 === n ? 2 : 1,
        i.set(a, 1),
        i.set(s, 1 + a.length),
        i
}

function n() {
    return {
        key : 'ea9d9d4f9a983fe6f6382f29c7b46b8d6dc47abc6da36662e6ddff8c78902f65',
        version : 1
    }
}



async function decryptText(encodeText) {
    const {key: a, version: o} = n()
        , r = Uo(a || "");
    const s = Number(o || 0)
    const t = Uo(encodeText)
        , xx = decryptResponse(t, r, s);
    return (new TextDecoder).decode(xx)
}

async function encryptText(data) {
    const {key: a, version: o} = n()
        , r = Uo(a || "");
    const b = await encryptRequest((new TextEncoder).encode(data), r);
    return Array.from(b).map(e => e.toString(16).padStart(2, "0")).join("")
}

$.exports = {
    decryptText,
    encryptText
}