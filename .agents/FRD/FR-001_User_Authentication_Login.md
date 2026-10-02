# FR-00.1 User Authentication & Login

| Atribut | Keterangan |
|---|---|
| **Modul** | FR-00 System Security & Access Management |
| **Proyek** | Underwear Manufacturing ERP — THEUNDERWEARSUPPLY |
| **Versi** | 1.0 |
| **Konvensi & Legenda** | Lihat `../00_INDEX_FRD.md` |

---

**Nama & Deskripsi**
Gerbang masuk sistem yang aman dan fleksibel. Mendukung dua metode: SSO Google Workspace/Gmail (OAuth 2.0) dan login standar (username/email + password). Setelah login, pengguna diarahkan ke dasbor sesuai role.

**Alur Kerja**
1. Pengguna membuka halaman Login.
2. Memilih **Sign in with Google** atau mengisi email/username + password.
3. Sistem memvalidasi kredensial (OAuth callback atau hash password).
4. Sistem membaca role pengguna (Admin, Founder, Finance, Supervisor, Staff).
5. Sistem membuat sesi (JWT access + refresh token).
6. Redirect ke dasbor role:
   - Admin → System Settings
   - Founder → Founder Dashboard
   - Finance → Finance Dashboard
   - Supervisor → Supervisor Dashboard
   - Staff → Kiosk "Tap & Scan"

**Proses Validasi**
- Email Google harus terdaftar dan berstatus **Active** di User Management (SSO tidak membuat akun otomatis).
- Password minimal 8 karakter, kombinasi huruf & angka.
- Akun dikunci sementara 15 menit setelah 5 kali gagal login berturut-turut.
- Akun berstatus Deactivated tidak dapat login.

**Penanganan Error**
| Kondisi | Pesan / Aksi |
|---|---|
| Kredensial salah | "Email atau password salah." (tanpa menyebut field mana) |
| Email Google tidak terdaftar | "Akun Google ini belum terdaftar. Hubungi Admin." |
| Akun terkunci | "Akun dikunci sementara. Coba lagi dalam 15 menit." |
| Akun nonaktif | "Akun Anda tidak aktif. Hubungi Admin." |
| OAuth gagal/timeout | "Login Google gagal. Silakan coba lagi atau gunakan login standar." |
| Semua percobaan login (berhasil/gagal) | Dicatat di Audit Log |

**Hak Akses**
Semua role dapat login. Hanya Admin yang dapat membuat/mengaktifkan akun.

**API**
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/auth/login` | Login standar |
| GET | `/auth/google` | Inisiasi OAuth Google |
| GET | `/auth/google/callback` | Callback OAuth |
| POST | `/auth/refresh` | Perbarui access token |
| POST | `/auth/logout` | Akhiri sesi |
| POST | `/auth/forgot-password` | Kirim tautan reset password |
| POST | `/auth/reset-password` | Set password baru |

```json
// POST /auth/login — Request
{ "username": "supervisor.cutting", "password": "********" }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": "USR-014", "name": "Rudi", "role": "SUPERVISOR" },
  "redirect": "/dashboard/supervisor"
}
```
