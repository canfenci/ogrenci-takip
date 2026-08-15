// ==================== FIREBASE CONFIGURATION & INITIALIZATION ====================

// Firebase is active in production; users may still choose local-only mode from the login screen.
const CLOUD_FEATURES_ENABLED = true;

const firebaseConfig = {
  apiKey: "AIzaSyBga07O0BZ-xbEAOPGc10o3DnJXqtCADIY",
  authDomain: "canfenci-kocluk.firebaseapp.com",
  projectId: "canfenci-kocluk",
  storageBucket: "canfenci-kocluk.firebasestorage.app",
  messagingSenderId: "337325316217",
  appId: "1:337325316217:web:df8bf6c5a3e3fa2f8a1ca8",
  measurementId: "G-MVH6K3X243"
};

let db = null;
let auth = null;
let isFirebaseActive = false;

try {
    // Check if firebase is loaded globally
    if (CLOUD_FEATURES_ENABLED && typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true })
            .then(() => console.log("Firestore offline persistence enabled."))
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn("Firestore offline persistence failed: Multiple tabs open.");
                } else if (err.code === 'unimplemented') {
                    console.warn("Firestore offline persistence unimplemented in this browser.");
                }
            });
        auth = firebase.auth();
        isFirebaseActive = true;
        window.db = db;
        window.auth = auth;
        window.isFirebaseActive = true;
        console.log("Firebase initialized successfully");
    } else if (CLOUD_FEATURES_ENABLED) {
        console.warn("Firebase SDK not found on window object.");
        window.isFirebaseActive = false;
    } else {
        console.info("Cloud features are disabled; running in local development mode.");
    }
} catch (err) {
    console.warn("Firebase initialization failed:", err);
    isFirebaseActive = false;
    window.isFirebaseActive = false;
}

window.db = db;
window.auth = auth;
window.isFirebaseActive = isFirebaseActive;
window.CLOUD_FEATURES_ENABLED = CLOUD_FEATURES_ENABLED;

export { db, auth, isFirebaseActive, CLOUD_FEATURES_ENABLED };

import { store, STORAGE_KEY, SCHEDULE_KEY, DERS_KAYITLARI_KEY } from './store.js';
import { showSyncStatus, handleFirebaseError } from './ui-helpers.js';

const LOCAL_DATA_OWNER_KEY = 'canfenci_local_data_owner_uid_v1';
const DEFAULT_TEACHER_BRANCHES = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"];

function clearCloudState() {
    store.globalStudents = [];
    store.globalHomeworks = [];
    store.globalSchedules = {};
    store.globalLessons = {};
    store.globalGroups = [];
    store.currentStudentId = null;
}

async function hydrateTeacherProfile(user) {
    const profileDoc = await db.collection("users").doc(user.uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : {};
    const branches = Array.isArray(profile.branches) && profile.branches.length > 0
        ? profile.branches
        : DEFAULT_TEACHER_BRANCHES;

    store.teacherBranches = branches;
    store.teacherName = profile.name || "Öğretmen Adı";
    store.teacherSchool = profile.school || "Belirtilmemiş Okul";
    localStorage.setItem('teacher_branches_v1', JSON.stringify(branches));

    if (profile.name) localStorage.setItem('teacher_name_v1', profile.name);
    else localStorage.removeItem('teacher_name_v1');
    if (profile.school) localStorage.setItem('teacher_school_v1', profile.school);
    else localStorage.removeItem('teacher_school_v1');
    if (profile.name && profile.school) localStorage.setItem('teacher_profile_completed_v1', 'true');
    else localStorage.removeItem('teacher_profile_completed_v1');
}

export function resetFirestoreSync() {
    (store.firestoreUnsubscribers || []).forEach(unsubscribe => {
        try { unsubscribe(); } catch (err) { console.warn('Sync listener could not be closed:', err); }
    });
    store.firestoreUnsubscribers = [];
    store.isSyncInitialized = false;
    store.syncUserId = null;
    store.useFirestore = false;
    clearCloudState();
}

export async function initializeFirestoreSync() {
    if (!CLOUD_FEATURES_ENABLED || !isFirebaseActive) return;
    const user = auth.currentUser;
    if (!user) return;
    if (store.isSyncInitialized && store.syncUserId === user.uid) return;
    if (store.isSyncInitialized || store.syncUserId) resetFirestoreSync();

    store.isSyncInitialized = true;
    store.syncUserId = user.uid;
    // Never expose shared browser-local records while an authenticated account
    // is waiting for its own Firestore snapshot.
    store.useFirestore = true;
    clearCloudState();

    showSyncStatus("Veriler buluttan yükleniyor...", false);

    try {
        await hydrateTeacherProfile(user);
        let initialStudentsSnapshotHandled = false;

        // Listen to students. Cloud mode is enabled only after the first snapshot
        // and the local-to-cloud migration choice have been resolved.
        const unsubscribeStudents = db.collection("students").where("userId", "==", user.uid).onSnapshot(async snapshot => {
            if (store.syncUserId !== user.uid) return;
            store.globalStudents = [];
            snapshot.forEach(doc => store.globalStudents.push(doc.data()));

            if (!initialStudentsSnapshotHandled) {
                initialStudentsSnapshotHandled = true;
                let localStudents = [];
                try {
                    localStudents = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
                } catch (err) {
                    console.warn('Local migration data could not be read:', err);
                }

                const localDataOwner = localStorage.getItem(LOCAL_DATA_OWNER_KEY);
                const belongsToAnotherAccount = localDataOwner && localDataOwner !== user.uid;

                if (snapshot.empty && localStudents.length > 0 && !belongsToAnotherAccount) {
                    const approved = confirm(`Bulut hesabınız (${user.email || 'mevcut hesap'}) henüz boş. Bu cihazdaki mevcut öğrenci, ödev, ders ve program kayıtlarını bu hesaba aktarmak ister misiniz?\n\nYalnızca bu kayıtlar bu hesaba aitse Evet'i seçin. Hayır seçerseniz yerel kayıtlar silinmez ve çevrimdışı moddan erişilebilir.`);
                    if (approved) {
                        const migrated = await runMigration();
                        if (migrated) localStorage.setItem(LOCAL_DATA_OWNER_KEY, user.uid);
                    } else {
                        showSyncStatus("Bulut hesabı boş; yerel kayıtlar bu hesaba aktarılmadı.", false);
                    }
                } else if (!snapshot.empty) {
                    // A populated cloud account is the authoritative owner of
                    // legacy local data on this browser.
                    localStorage.setItem(LOCAL_DATA_OWNER_KEY, user.uid);
                } else if (belongsToAnotherAccount) {
                    showSyncStatus("Bu hesap için bulut kaydı bulunmuyor.", false);
                }
            }

            if (store.currentPage === "home" && window.renderHomeScreen) {
                window.renderHomeScreen();
            } else if (store.currentPage === "student" && store.currentStudentId && window.renderStudentPanel) {
                window.renderStudentPanel(store.currentStudentId);
            } else if (store.currentPage === "reminderHome" && window.renderReminderHome) {
                window.renderReminderHome();
            }
        }, err => {
            console.error("Students sync error:", err);
            handleFirebaseError(err);
        });
        store.firestoreUnsubscribers.push(unsubscribeStudents);

        // Listen to homeworks
        const unsubscribeHomeworks = db.collection("homeworks").where("userId", "==", user.uid).onSnapshot(snapshot => {
            if (store.syncUserId !== user.uid) return;
            store.globalHomeworks = [];
            snapshot.forEach(doc => store.globalHomeworks.push(doc.data()));
            
            if (store.currentPage === "odevTakibi" && window.renderOdevTakibi) {
                window.renderOdevTakibi();
            } else if (store.currentPage === "studentOdevDetay" && window._currentOdevStudentId && window.renderStudentOdevDetay) {
                window.renderStudentOdevDetay(window._currentOdevStudentId);
            }
        }, err => {
            console.error("Homeworks sync error:", err);
        });
        store.firestoreUnsubscribers.push(unsubscribeHomeworks);

        // Listen to schedules
        const unsubscribeSchedules = db.collection("schedules").where("userId", "==", user.uid).onSnapshot(snapshot => {
            if (store.syncUserId !== user.uid) return;
            store.globalSchedules = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                store.globalSchedules[data.studentId] = data.lessons;
            });
            if (store.currentPage === "schedule" && window.renderSchedulePage) {
                window.renderSchedulePage();
            }
        }, err => {
            console.error("Schedules sync error:", err);
        });
        store.firestoreUnsubscribers.push(unsubscribeSchedules);

        // Listen to lesson records
        const unsubscribeLessons = db.collection("lessons").where("userId", "==", user.uid).onSnapshot(snapshot => {
            if (store.syncUserId !== user.uid) return;
            store.globalLessons = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                store.globalLessons[data.studentId] = data.kayitlar;
            });
            if (store.currentPage === "dersKayitlari" && window.renderDersKayitlari) {
                window.renderDersKayitlari();
            } else if (store.currentPage === "dersDetay" && window._currentDersKayitStudentId && window.renderDersDetay) {
                window.renderDersDetay(window._currentDersKayitStudentId);
            }
        }, err => {
            console.error("Lessons sync error:", err);
        });
        store.firestoreUnsubscribers.push(unsubscribeLessons);

        // Listen to groups
        const unsubscribeGroups = db.collection("groups").where("userId", "==", user.uid).onSnapshot(snapshot => {
            if (store.syncUserId !== user.uid) return;
            store.globalGroups = [];
            snapshot.forEach(doc => {
                store.globalGroups.push(doc.data());
            });
            if (store.currentPage === "groups" && window.renderGroupsPage) {
                window.renderGroupsPage();
            }
        }, err => {
            console.error("Groups sync error:", err);
        });
        store.firestoreUnsubscribers.push(unsubscribeGroups);

        // Listen to teacher settings (branches & name)
        if (user) {
            const unsubscribeUser = db.collection("users").doc(user.uid).onSnapshot(doc => {
                if (store.syncUserId !== user.uid) return;
                if (doc.exists) {
                    const data = doc.data();
                    let updated = false;
                    if (data.branches) {
                        const branches = data.branches;
                        localStorage.setItem('teacher_branches_v1', JSON.stringify(branches));
                        store.teacherBranches = branches;
                        updated = true;
                    }
                    if (data.name) {
                        const name = data.name;
                        localStorage.setItem('teacher_name_v1', name);
                        store.teacherName = name;
                        updated = true;
                    }
                    if (data.school) {
                        const school = data.school;
                        localStorage.setItem('teacher_school_v1', school);
                        store.teacherSchool = school;
                        updated = true;
                    }
                    
                    // Trigger UI refresh
                    if (updated) {
                        if (store.currentPage === "general" && window.renderGenelIslemler) {
                            window.renderGenelIslemler();
                        } else if (store.currentPage === "homework" && window.renderOdevTakibi) {
                            window.renderOdevTakibi();
                        }
                    }
                }
            }, err => {
                console.error("Users settings sync error:", err);
            });
            store.firestoreUnsubscribers.push(unsubscribeUser);
        }

        showSyncStatus("Firebase bağlantısı hazır.", false);
    } catch (err) {
        console.error("Firestore sync init error:", err);
        handleFirebaseError(err);
    }
}

export async function runMigration() {
    if (!CLOUD_FEATURES_ENABLED) return false;
    try {
        const user = auth.currentUser;
        if (!user) return false;
        const userId = user.uid;
        
        const localStudents = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        const localGroups = JSON.parse(localStorage.getItem("student_groups_v1")) || [];
        if (localStudents.length === 0 && localGroups.length === 0) return false;

        showSyncStatus("Yerel veriler buluta aktarılıyor...", false);

        for (let s of localStudents) {
            const odevler = s.odevler || [];
            const sCloned = { ...s, userId }; // Stamp with userId
            delete sCloned.odevler; // Separation of homework data

            await db.collection("students").doc(s.id).set(sCloned);

            for (let o of odevler) {
                o.studentName = s.adSoyad;
                o.userId = userId; // Stamp with userId
                await db.collection("homeworks").doc(o.id).set(o);
            }

            const localSchedules = JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || {};
            if (localSchedules[s.id]) {
                await db.collection("schedules").doc(s.id).set({ studentId: s.id, lessons: localSchedules[s.id], userId });
            }

            const localLessons = JSON.parse(localStorage.getItem(DERS_KAYITLARI_KEY)) || {};
            if (localLessons[s.id]) {
                await db.collection("lessons").doc(s.id).set({ studentId: s.id, kayitlar: localLessons[s.id], userId });
            }
        }

        for (let g of localGroups) {
            const gCloned = { ...g, userId };
            await db.collection("groups").doc(g.id).set(gCloned);
        }

        showSyncStatus("✅ Aktarım başarıyla tamamlandı!", false);
        return true;
    } catch (err) {
        console.error("Migration error:", err);
        showSyncStatus("⚠️ Aktarım sırasında hata oluştu.", true);
        return false;
    }
}

export function getLocalMigrationSummary() {
    const readJson = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; }
        catch (_) { return fallback; }
    };
    const students = readJson(STORAGE_KEY, []);
    const groups = readJson("student_groups_v1", []);
    const schedules = readJson(SCHEDULE_KEY, {});
    const lessons = readJson(DERS_KAYITLARI_KEY, {});
    return {
        students: Array.isArray(students) ? students.length : 0,
        groups: Array.isArray(groups) ? groups.length : 0,
        schedules: Object.keys(schedules || {}).length,
        lessons: Object.values(lessons || {}).reduce((total, records) => total + (Array.isArray(records) ? records.length : 0), 0)
    };
}

export async function migrateLocalDataToCurrentAccount(confirmationEmail) {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) {
        return { ok: false, message: "Doğrulanmış bir bulut hesabıyla giriş yapmalısınız." };
    }

    const expectedEmail = String(user.email || '').trim().toLocaleLowerCase('tr-TR');
    const enteredEmail = String(confirmationEmail || '').trim().toLocaleLowerCase('tr-TR');
    if (!enteredEmail || enteredEmail !== expectedEmail) {
        return { ok: false, message: `Onay için açık hesabın e-posta adresini eksiksiz yazın: ${user.email}` };
    }

    const summary = getLocalMigrationSummary();
    if (summary.students === 0 && summary.groups === 0) {
        return { ok: false, message: "Bu Chrome profilinde aktarılabilecek yerel öğrenci veya grup kaydı bulunamadı." };
    }

    const existingCloudData = await db.collection("students").where("userId", "==", user.uid).limit(1).get();
    if (!existingCloudData.empty) {
        return { ok: false, message: "Bu bulut hesabında zaten öğrenci kayıtları var. Güvenlik için otomatik birleştirme durduruldu." };
    }

    const approved = confirm(`${summary.students} öğrenci, ${summary.lessons} ders kaydı ve ${summary.groups} grup ${user.email} hesabına kopyalanacak.\n\nYerel kayıtlar silinmeyecek. Devam edilsin mi?`);
    if (!approved) return { ok: false, message: "Aktarım iptal edildi; hiçbir kayıt değiştirilmedi." };

    const migrated = await runMigration();
    if (!migrated) return { ok: false, message: "Aktarım tamamlanamadı. Yerel kayıtlar korunuyor." };

    localStorage.setItem(LOCAL_DATA_OWNER_KEY, user.uid);
    return { ok: true, message: `Yerel kayıtlar ${user.email} bulut hesabına başarıyla aktarıldı.` };
}

// Bind to window for global access
window.initializeFirestoreSync = initializeFirestoreSync;
window.runMigration = runMigration;
window.resetFirestoreSync = resetFirestoreSync;
window.getLocalMigrationSummary = getLocalMigrationSummary;
window.migrateLocalDataToCurrentAccount = migrateLocalDataToCurrentAccount;
