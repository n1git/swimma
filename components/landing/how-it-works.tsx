import { Section } from "./section";

const STEPS = [
  {
    title: "Daftarkan organisasi",
    body: "Isi nama klub, akun pemilik, paket, dan periode. Organisasi, akun pemilik, dan klub pertama dibuat sekaligus.",
  },
  {
    title: "Pilih jenis klub dan modul",
    body: "Jenis klub menentukan istilah dan modul awal. Modul yang tidak dipakai bisa dimatikan kapan saja dari Pengaturan.",
  },
  {
    title: "Siapkan lokasi, fasilitas, dan paket",
    body: "Penyiapan klub memandu lokasi, fasilitas dengan saran sesuai jenis klub, dan paket keanggotaan pertama. Setiap langkah boleh dilewati.",
  },
  {
    title: "Tim dan anggota mulai memakai",
    body: "Tambahkan staf dengan perannya, daftarkan anggota, lalu aktifkan akun portal bagi anggota yang ingin melihat datanya sendiri.",
  },
];

export function HowItWorks() {
  return (
    <Section id="cara-kerja" eyebrow="Cara kerja" title="Dari pendaftaran sampai klub berjalan." className="bg-muted/50">
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
            <p className="text-pretty text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
