'use client';

/** Teks format WhatsApp (*tebal*, _miring_, tautan) ke HTML aman untuk pratinjau. */
function waToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return esc
    .replace(/(https?:\/\/[^\s]+)/g, '<span style="color:#027eb5;text-decoration:underline;word-break:break-all">$1</span>')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1<i>$2</i>')
    .replace(/\n/g, '<br/>');
}

interface Props {
  text: string;
  /** Jam pesan masuk (contoh "15.30"). */
  time: string;
  /** Nama kontak pengirim. */
  sender?: string;
}

/**
 * Mockup tampilan pesan di WhatsApp (layar HP): akun bisnis ApiRimba mengirim template peringatan.
 * Hanya tampilan; warna mengikuti WhatsApp mode terang.
 */
export default function WhatsAppPreview({ text, time, sender = 'ApiRimba Peringatan' }: Props) {
  return (
    <div
      className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[34px] border-[6px] border-[#1c1c1e] bg-[#1c1c1e] shadow-float"
      role="img"
      aria-label={`Pratinjau WhatsApp dari ${sender}: ${text}`}
    >
      {/* bilah status */}
      <div className="flex items-center justify-between bg-[#008069] px-5 pb-1 pt-2 text-[11px] font-semibold text-white">
        <span>{time}</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor"><rect x="0" y="6" width="2.5" height="4" rx=".5" /><rect x="3.8" y="4" width="2.5" height="6" rx=".5" /><rect x="7.6" y="2" width="2.5" height="8" rx=".5" /><rect x="11.4" y="0" width="2.5" height="10" rx=".5" /></svg>
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none"><rect x=".5" y=".5" width="16" height="9" rx="2" stroke="currentColor" /><rect x="2" y="2" width="11" height="6" rx="1" fill="currentColor" /><rect x="17.5" y="3.5" width="1.6" height="3" rx=".8" fill="currentColor" /></svg>
        </span>
      </div>
      {/* kepala percakapan */}
      <div className="flex items-center gap-2.5 bg-[#008069] px-3 pb-2.5 pt-1 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" className="size-9 rounded-full bg-white object-contain p-0.5" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex items-center gap-1 truncate text-[15px] font-semibold">
            {sender}
            <svg width="15" height="15" viewBox="0 0 24 24" aria-label="Akun terverifikasi"><path d="m12 1 2.6 2.1 3.3-.3.9 3.2 2.9 1.6-1 3.2 1 3.2-2.9 1.6-.9 3.2-3.3-.3L12 23l-2.6-2.1-3.3.3-.9-3.2-2.9-1.6 1-3.2-1-3.2 2.9-1.6.9-3.2 3.3.3z" fill="#25d366" /><path d="m8 12.3 2.6 2.6L16.2 9" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </p>
          <p className="text-[12px] text-white/80">Akun bisnis</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
      </div>
      {/* isi percakapan */}
      <div
        className="max-h-[470px] min-h-[380px] overflow-y-auto px-2.5 py-3"
        style={{
          backgroundColor: '#efeae2',
          backgroundImage: 'radial-gradient(rgba(0,0,0,.045) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <p className="mx-auto mb-3 w-fit rounded-[8px] bg-white/90 px-3 py-1 text-[11.5px] font-medium uppercase text-[#54656f] shadow-sm">Hari ini</p>
        <p className="mx-auto mb-3 max-w-[90%] rounded-[8px] bg-[#fff5c4] px-3 py-1.5 text-center text-[11.5px] leading-4 text-[#54656f] shadow-sm">
          Akun bisnis resmi. Pesan ini dikirim karena Anda mendaftar peringatan dini ApiRimba.
        </p>
        <div className="relative max-w-[92%] rounded-[8px] rounded-tl-none bg-white px-2.5 pb-1.5 pt-1.5 text-[14px] leading-[1.35] text-[#111b21] shadow-sm">
          <div dangerouslySetInnerHTML={{ __html: waToHtml(text) }} />
          <p className="mt-0.5 text-right text-[11px] text-[#667781]">{time}</p>
        </div>
      </div>
      {/* bilah ketik */}
      <div className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2">
        <div className="flex h-10 flex-1 items-center rounded-full bg-white px-4 text-[14px] text-[#8696a0]">Ketik pesan</div>
        <span className="grid size-10 place-items-center rounded-full bg-[#00a884] text-white" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z" /></svg>
        </span>
      </div>
    </div>
  );
}
