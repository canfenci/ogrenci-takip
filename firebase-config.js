// ==================== FIREBASE CONFIGURATION & INITIALIZATION ====================

// Keep cloud features off while the product and data model are still evolving.
// Switch this to true only when Firebase rules and the production data model are ready.
const CLOUD_FEATURES_ENABLED = false;

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

export async function initializeFirestoreSync() {
    if (!CLOUD_FEATURES_ENABLED || store.isSyncInitialized || !isFirebaseActive) return;
    const user = auth.currentUser;
    if (!user) return;
    store.isSyncInitialized = true;
    store.useFirestore = true;

    showSyncStatus("Veriler buluttan yükleniyor...", false);

    try {
        // Listen to students
        db.collection("students").where("userId", "==", user.uid).onSnapshot(snapshot => {
            store.globalStudents = [];
            snapshot.forEach(doc => store.globalStudents.push(doc.data()));
            
            // Check if local data needs migrating
            const localData = localStorage.getItem(STORAGE_KEY);
            if (snapshot.empty && localData && JSON.parse(localData).length > 0) {
                if (confirm("Bulut veritabanınız boş görünüyor. Mevcut yerel verilerinizi buluta aktarmak ister misiniz?")) {
                    runMigration();
                }
            }

            if (store.currentPage === "home" && window.renderHomeScreen) {
                window.renderHomeScreen();
            } else if (store.currentPage === "student" && store.currentStudentId && window.renderStudentPanel) {
                window.renderStudentPanel(store.currentStudentId);
            }
        }, err => {
            console.error("Students sync error:", err);
            handleFirebaseError(err);
        });

        // Listen to homeworks
        db.collection("homeworks").where("userId", "==", user.uid).onSnapshot(snapshot => {
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

        // Listen to schedules
        db.collection("schedules").where("userId", "==", user.uid).onSnapshot(snapshot => {
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

        // Listen to lesson records
        db.collection("lessons").where("userId", "==", user.uid).onSnapshot(snapshot => {
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

        // Listen to groups
        db.collection("groups").where("userId", "==", user.uid).onSnapshot(snapshot => {
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

        // Listen to teacher settings (branches & name)
        if (user) {
            db.collection("users").doc(user.uid).onSnapshot(doc => {
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
        }

        showSyncStatus("Bulut senkronizasyonu aktif.", false);
    } catch (err) {
        console.error("Firestore sync init error:", err);
        handleFirebaseError(err);
    }
}

export async function runMigration() {
    if (!CLOUD_FEATURES_ENABLED) return;
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userId = user.uid;
        
        const localStudents = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        const localGroups = JSON.parse(localStorage.getItem("student_groups_v1")) || [];
        if (localStudents.length === 0 && localGroups.length === 0) return;

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
    } catch (err) {
        console.error("Migration error:", err);
        showSyncStatus("⚠️ Aktarım sırasında hata oluştu.", true);
    }
}

// Bind to window for global access
window.initializeFirestoreSync = initializeFirestoreSync;
window.runMigration = runMigration;
