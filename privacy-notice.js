import { escapeHtml } from './store.js';

export const PRIVACY_NOTICE_VERSION = '2026-08-15-v1';

export function showPrivacyNotice() {
    document.getElementById('privacyNoticeModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'privacyNoticeModal';
    modal.className = 'fixed inset-0 z-[100] bg-gray-950/60 backdrop-blur-sm p-4 flex items-center justify-center';
    modal.innerHTML = `
        <section role="dialog" aria-modal="true" aria-labelledby="privacyNoticeTitle" class="app-modal bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            <header class="p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Pilot Sürüm · ${escapeHtml(PRIVACY_NOTICE_VERSION)}</p>
                    <h2 id="privacyNoticeTitle" class="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-1">KVKK Aydınlatma Metni</h2>
                </div>
                <button type="button" onclick="closePrivacyNotice()" class="min-w-[44px] min-h-[44px] rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Aydınlatma metnini kapat"><i class="fas fa-times"></i></button>
            </header>
            <div class="p-5 md:p-6 overflow-y-auto text-sm leading-6 text-gray-700 dark:text-gray-300 space-y-5">
                <div class="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 p-4">
                    <strong class="text-amber-900 dark:text-amber-200">Pilot kullanım uyarısı:</strong>
                    <span class="text-amber-800 dark:text-amber-300"> Uygulama test aşamasındadır. Hukuki ve kurumsal veri işleme süreçleri tamamlanana kadar gerçek öğrenci/veli verileri yerine sınırlı veya örnek verilerle test edilmesi önerilir. Sağlık bilgisi, kimlik numarası, özel nitelikli kişisel veri veya gereksiz açıklama girilmemelidir.</span>
                </div>

                <section><h3 class="font-black text-gray-900 dark:text-white">1. Veri sorumlusu ve iletişim</h3><p>Öğretmen hesap bilgilerinin işlenmesi bakımından veri sorumlusu: <strong>Murat Can Baş</strong>. İletişim: <a class="text-indigo-600 dark:text-indigo-400 underline" href="mailto:cnmrt84@gmail.com">cnmrt84@gmail.com</a>.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">2. İşlenen veri kategorileri</h3><p>Hesap e-postası, öğretmen adı-soyadı, okul/kurum ve branş bilgileri; öğretmenin uygulamaya girdiği öğrenci adı, sınıf, okul, hedef, veli iletişim bilgisi, ders programı, ders/ödeme durumu, ödev ve akademik performans kayıtları işlenebilir. Şifreler uygulama tarafından görüntülenmez; Firebase Authentication tarafından yönetilir.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">3. İşleme amaçları</h3><p>Hesap oluşturma ve doğrulama, öğretmene ait çalışma alanını sunma, cihazlar arası senkronizasyon, öğrenci-ders-ödev takibi, raporlama, hatırlatma hazırlama, hata ve güvenlik olaylarının yönetimi amaçlarıyla sınırlı olarak işlenir. Veriler reklam veya pazarlama amacıyla kullanılmaz.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">4. Toplama yöntemi ve hukuki sebep</h3><p>Veriler web/PWA formları üzerinden elektronik ve kısmen otomatik yollarla elde edilir. Öğretmen hesap verileri, 6698 sayılı Kanun’un 5/2-c maddesi kapsamında kullanıcı ilişkisinin kurulması ve hizmetin sunulması; gerekli güvenlik kayıtları ise 5/2-f kapsamındaki meşru menfaat doğrultusunda işlenir. Açık rıza gerektiren yeni bir faaliyet ortaya çıkarsa bu süreç aydınlatmadan ayrı yürütülür.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">5. Aktarım ve altyapı sağlayıcıları</h3><p>Kimlik doğrulama ve bulut veritabanı hizmeti için Google Firebase/Firestore, uygulamanın yayımlanması için GitHub Pages altyapısı kullanılmaktadır. Teknik hizmet sunumu ve güvenlik amacıyla bu sağlayıcılar veriye sınırlı biçimde erişebilir; altyapı kullanımı yurt dışına veri aktarımı doğurabilir. Pilotun gerçek verilerle genişletilmesinden önce KVKK’nın yurt dışı aktarım şartlarına ilişkin uygun güvenceler ayrıca tamamlanmalıdır.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">6. Öğretmenin sorumluluğu</h3><p>Öğretmen, öğrenci ve veli verilerini hangi amaçla uygulamaya gireceğine karar verir. Bu nedenle gerekli bilgilendirmeyi öğrenciye/veliye yapmak, uygun hukuki sebebi belirlemek, yalnızca gerekli veriyi girmek ve yetkisiz kişilerle paylaşmamak öğretmenin sorumluluğundadır.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">7. Saklama ve güvenlik</h3><p>Bulut kayıtları hesap açık kaldığı ve hizmet amacı sürdüğü müddetçe saklanır. Misafir modu kayıtları yalnızca kullanılan cihazın tarayıcı alanında tutulur. Hesaplar doğrulanmış kullanıcı kimliği ve sahiplik kontrollü Firestore kurallarıyla ayrılır.</p></section>

                <section><h3 class="font-black text-gray-900 dark:text-white">8. İlgili kişi hakları</h3><p>İlgili kişiler; KVKK’nın 11. maddesi kapsamında verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltme, şartları oluştuğunda silme/yok etme, otomatik işlem sonuçlarına itiraz etme ve kanuna aykırı işleme nedeniyle zarar meydana geldiği iddiasında zararın giderilmesini talep etme haklarına sahiptir. Bu bilgilendirme otomatik bir sorumluluk kabulü değildir; sorumluluk somut olayın koşullarına ve ilgili mevzuata göre belirlenir. Başvurular <a class="text-indigo-600 dark:text-indigo-400 underline" href="mailto:cnmrt84@gmail.com">cnmrt84@gmail.com</a> adresine iletilebilir. Başvuruda talebin ve ilgili hesabın anlaşılmasına yetecek bilgi verilmelidir; e-posta yoluyla gereksiz öğrenci verisi gönderilmemelidir.</p></section>

                <p class="text-xs text-gray-500">Bu metin pilot ürün bilgilendirmesidir; tek başına tüm kurumsal KVKK yükümlülüklerinin yerine getirildiği anlamına gelmez.</p>
            </div>
            <footer class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end"><button type="button" onclick="closePrivacyNotice()" class="btn-primary min-h-[44px] px-6">Okudum, Kapat</button></footer>
        </section>`;
    modal.addEventListener('click', event => { if (event.target === modal) closePrivacyNotice(); });
    document.body.appendChild(modal);
    modal.querySelector('button')?.focus();
}

export function closePrivacyNotice() {
    document.getElementById('privacyNoticeModal')?.remove();
}

window.showPrivacyNotice = showPrivacyNotice;
window.closePrivacyNotice = closePrivacyNotice;
