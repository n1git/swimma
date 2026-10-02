export const CHECKIN_ERROR_CODES = new Set(["CK001", "CK002", "CK003", "CK004", "CK005"]);

export const CHECKIN_RESULT_MESSAGE: Record<string, string> = {
  CK001: "Check-in belum tersedia di klub ini.",
  CK002: "Keanggotaan Anda tidak aktif. Hubungi pengelola klub.",
  CK003: "Anda belum punya paket aktif. Hubungi pengelola klub.",
  CK004: "Sesi paket Anda sudah habis. Hubungi pengelola klub untuk memperpanjang.",
  CK005: "Kode QR tidak valid atau sudah kedaluwarsa. Pindai ulang QR di pintu masuk.",
  NOT_MEMBER: "Anda bukan anggota klub ini.",
  STAFF: "Check-in dengan QR hanya untuk akun anggota.",
  RATE: "Terlalu banyak percobaan. Coba lagi sebentar lagi.",
  ERROR: "Check-in gagal. Coba pindai ulang.",
};
