/* ============================================
   GRADE X ARENA
   Application logic — repaired & deduplicated version
============================================ */

// 1. SUPABASE CONNECTION

const SUPABASE_URL = "https://vkojdzbhautxwcujmjiu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tbsTO1TPgn5KDoynYC8szQ_w69EiGJc";
const BUCKET_NAME = "Grade-x";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// PDF.js worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


// ============================================
// 2. ELEMENTS
// ============================================

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");
const authToggle = document.getElementById("authToggle");
const authStatus = document.getElementById("authStatus");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const studentEmail = document.getElementById("studentEmail");
const signOutBtn = document.getElementById("signOutBtn");

const uploadForm = document.getElementById("uploadForm");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");

const pdfList = document.getElementById("pdfList");
const searchPDF = document.getElementById("searchPDF");

const pdfReader = document.getElementById("pdfReader");
const readerTitle = document.getElementById("readerTitle");
const readerPages = document.getElementById("readerPages");
const closeReader = document.getElementById("closeReader");


// ============================================
// 3. APPLICATION STATE
// ============================================

let currentUser = null;
let isSigningUp = true;
let documents = [];
let currentPdfUrl = null;


// ============================================
// 4. HELPERS
// ============================================

function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#fb7185" : "#4ade80";
}

function safeText(value) {
    return String(value ?? "");
}

function formatFileSize(bytes) {
    if (!bytes) return "PDF document";

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(0) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHTML(value) {
    return safeText(value).replace(/[&<>"']/g, function (char) {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[char];
    });
}

function getElement(id) {
    return document.getElementById(id);
}


// ============================================
// 5. SIGN UP / SIGN IN
// ============================================

if (authToggle) {
    authToggle.addEventListener("click", function () {
        isSigningUp = !isSigningUp;

        authTitle.textContent = isSigningUp
            ? "Join GRADE X"
            : "Welcome Back";

        authMessage.textContent = isSigningUp
            ? "Create your student account to get started."
            : "Sign in to continue learning.";

        authSubmit.textContent = isSigningUp
            ? "Create Account"
            : "Sign In";

        authToggle.textContent = isSigningUp
            ? "Already have an account? Sign in"
            : "New student? Create an account";

        if (authStatus) authStatus.textContent = "";
    });
}

if (authForm) {
    authForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        authSubmit.disabled = true;

        showMessage(
            authStatus,
            isSigningUp ? "Creating your account..." : "Signing you in..."
        );

        try {
            if (isSigningUp) {
                const { data, error } = await db.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        emailRedirectTo:
                            "https://kevinmorgan2949-dev.github.io/Grade-x-app/"
                    }
                });

                if (error) throw error;

                if (data.session) {
                    showMessage(
                        authStatus,
                        "Account created successfully!"
                    );
                } else {
                    showMessage(
                        authStatus,
                        "Account created! Check your email for the verification link. Sign in after verification."
                    );
                }
            } else {
                const { error } = await db.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;

                showMessage(authStatus, "Login successful!");
            }
        } catch (error) {
            showMessage(
                authStatus,
                error.message || "Authentication failed. Please try again.",
                true
            );
        } finally {
            authSubmit.disabled = false;
        }
    });
}


// ============================================
// 6. AUTHENTICATION STATE
// ============================================

async function updateAppSession(session) {
    currentUser = session?.user || null;

    if (!currentUser) {
        authSection.hidden = false;
        appSection.hidden = true;

        documents = [];

        if (pdfList) pdfList.innerHTML = "";

        if (pdfReader) pdfReader.hidden = true;

        currentPdfUrl = null;
        return;
    }

    authSection.hidden = true;
    appSection.hidden = false;

    if (studentEmail) {
        studentEmail.textContent = currentUser.email || "Student";
    }

    renderProfile();

    await loadDocuments();
}

db.auth.onAuthStateChange(function (event, session) {
    setTimeout(function () {
        updateAppSession(session).catch(function (error) {
            console.error("GRADE X session update error:", error);
        });
    }, 0);
});

async function restoreSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error("Session error:", error.message);
        showMessage(authStatus, error.message, true);
        return;
    }

    await updateAppSession(data.session);
}

if (signOutBtn) {
    signOutBtn.addEventListener("click", async function () {
        signOutBtn.disabled = true;

        try {
            const { error } = await db.auth.signOut();

            if (error) throw error;
        } catch (error) {
            alert("Could not sign out: " + error.message);
        } finally {
            signOutBtn.disabled = false;
        }
    });
}


// ============================================
// 7. NAVIGATION
// ============================================

const navButtons = document.querySelectorAll(".nav-btn");

const pages = {
    library: getElement("libraryPage"),
    bot: getElement("botPage"),
    arena: getElement("arenaPage"),
    wallet: getElement("walletPage"),
    comingSoon: getElement("comingSoonPage"),
    profile: getElement("profilePage")
};

navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const pageName = button.dataset.page;

        navButtons.forEach(function (item) {
            item.classList.remove("active");
        });

        button.classList.add("active");

        Object.keys(pages).forEach(function (key) {
            if (pages[key]) {
                pages[key].hidden = key !== pageName;
            }
        });
    });
});


// ============================================
// 8. UPLOAD PDF TO SUPABASE STORAGE
// ============================================

if (uploadForm) {
    uploadForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser) {
            showMessage(uploadStatus, "Please sign in first.", true);
            return;
        }

        const title = getElement("pdfTitle").value.trim();
        const subject = getElement("pdfSubject").value;
        const description =
            getElement("pdfDescription").value.trim();

        const fileInput = getElement("pdfFile");
        const file = fileInput.files[0];

        if (!file) {
            showMessage(uploadStatus, "Choose a PDF file first.", true);
            return;
        }

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            showMessage(uploadStatus, "Only PDF files are allowed.", true);
            return;
        }

        const MAX_FILE_SIZE = 20 * 1024 * 1024;

        if (file.size > MAX_FILE_SIZE) {
            showMessage(
                uploadStatus,
                "This file is over 20 MB. Please choose a smaller PDF.",
                true
            );
            return;
        }

        uploadBtn.disabled = true;

        let storagePath = null;
        let uploaded = false;

        showMessage(uploadStatus, "Uploading PDF to the cloud...");

        try {
            const safeFileName = file.name
                .replace(/[^a-zA-Z0-9._-]/g, "_")
                .slice(-100);

            storagePath =
                currentUser.id +
                "/" +
                crypto.randomUUID() +
                "_" +
                safeFileName;

            const { error: uploadError } = await db.storage
                .from(BUCKET_NAME)
                .upload(storagePath, file, {
                    contentType: "application/pdf",
                    upsert: false
                });

            if (uploadError) throw uploadError;

            uploaded = true;

            showMessage(
                uploadStatus,
                "File uploaded! Saving document details..."
            );

            const { error: recordError } = await db
                .from("pdf_documents")
                .insert({
                    title: title,
                    subject: subject,
                    description: description,
                    storage_path: storagePath,
                    original_filename: file.name,
                    file_size: file.size,
                    uploader_id: currentUser.id,
                    is_published: true
                });

            if (recordError) throw recordError;

            uploadForm.reset();

            showMessage(
                uploadStatus,
                "Success! Your PDF is now in the GRADE X Library."
            );

            await loadDocuments();
        } catch (error) {
            console.error("PDF upload error:", error);

            if (uploaded && storagePath) {
                const { error: cleanupError } = await db.storage
                    .from(BUCKET_NAME)
                    .remove([storagePath]);

                if (cleanupError) {
                    console.error("Cleanup error:", cleanupError.message);
                }
            }

            showMessage(
                uploadStatus,
                "Upload failed: " + error.message,
                true
            );
        } finally {
            uploadBtn.disabled = false;
        }
    });
}


// ============================================
// 9. LOAD PDF LIBRARY
// ============================================

async function loadDocuments() {
    if (!currentUser || !pdfList) return;

    pdfList.innerHTML =
        '<div class="empty-state"><span>⏳</span><h3>Loading library...</h3></div>';

    try {
        const { data, error } = await db
            .from("published_pdfs_with_authors")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        documents = (data || []).map(function (doc) {
            return {
                ...doc,
                author_name: doc.author_name || "GRADE X Student",
                author_avatar: doc.author_avatar || ""
            };
        });

        renderDocuments();
    } catch (error) {
        console.error("Library error:", error);

        pdfList.innerHTML = `
            <div class="empty-state">
                <span>⚠️</span>
                <h3>Library could not load</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// ============================================
// 10. DISPLAY DOCUMENTS
// ============================================

function renderDocuments() {
    if (botPDF) {
        const previousSelection = botPDF.value;

        botPDF.innerHTML =
            '<option value="">General questions (no PDF selected)</option>';

        documents.forEach(function (doc) {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent =
                doc.title + " — " + (doc.subject || "General");

            botPDF.appendChild(option);
        });

        if (documents.some(function (doc) {
            return String(doc.id) === previousSelection;
        })) {
            botPDF.value = previousSelection;
        }
    }

    if (!pdfList) return;

    const searchTerm = searchPDF
        ? searchPDF.value.trim().toLowerCase()
        : "";

    const filteredDocuments = documents.filter(function (doc) {
        return (
            safeText(doc.title).toLowerCase().includes(searchTerm) ||
            safeText(doc.subject).toLowerCase().includes(searchTerm) ||
            safeText(doc.description).toLowerCase().includes(searchTerm)
        );
    });

    if (!filteredDocuments.length) {
        pdfList.innerHTML = `
            <div class="empty-state">
                <span>📚</span>
                <h3>No documents found</h3>
                <p>Try another search or upload a learning resource.</p>
            </div>
        `;
        return;
    }

    pdfList.innerHTML = filteredDocuments.map(function (doc) {
        return `
            <article class="pdf-card">
                <div class="pdf-icon">📕</div>

                <h3>${escapeHTML(doc.title)}</h3>

                <p>📘 ${escapeHTML(doc.subject || "General")}</p>

                <p>${escapeHTML(doc.description || "Study material")}</p>

                <div class="pdf-author">
                    ${
                        doc.author_avatar
                            ? `<img
                                src="${escapeHTML(doc.author_avatar)}"
                                alt=""
                                class="pdf-author-avatar"
                                style="width:32px;height:32px;min-width:32px;max-width:32px;min-height:32px;max-height:32px;object-fit:cover;border-radius:50%;flex-shrink:0;">`
                            : `<span
                                class="pdf-author-avatar-fallback"
                                style="width:32px;height:32px;min-width:32px;max-width:32px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:16px;">👤</span>`
                    }

                    <button
                        type="button"
                        class="pdf-author-name"
                        data-action="view-author"
                        data-author-id="${escapeHTML(doc.uploader_id)}">
                        ${escapeHTML(doc.author_name || "GRADE X Student")}
                    </button>
                </div>

                <p>${formatFileSize(doc.file_size)}</p>

                <div class="pdf-actions">
                    <button
                        type="button"
                        class="secondary-btn"
                        data-action="read"
                        data-id="${escapeHTML(doc.id)}">
                        Read
                    </button>

                    <button
                        type="button"
                        class="secondary-btn"
                        data-action="download"
                        data-id="${escapeHTML(doc.id)}">
                        Download
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

if (searchPDF) {
    searchPDF.addEventListener("input", renderDocuments);
}


// ============================================
// 11. GET A PUBLIC PDF URL
// ============================================

function getPublicPdfUrl(storagePath) {
    const { data } = db.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);

    return data.publicUrl;
}


// ============================================
// 12. READ PDF AND PUBLIC STUDENT PROFILES
// ============================================

if (pdfList) {
    pdfList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;

        if (action === "view-author") {
            const authorId = button.dataset.authorId;

            if (!authorId) {
                alert("Student profile is unavailable.");
                return;
            }

            await openPublicStudentProfile(authorId);
            return;
        }

        const documentId = button.dataset.id;

        const doc = documents.find(function (item) {
            return String(item.id) === String(documentId);
        });

        if (!doc) return;

        const url = getPublicPdfUrl(doc.storage_path);

        if (action === "download") {
            const link = document.createElement("a");

            link.href = url;
            link.download = doc.original_filename || "document.pdf";
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();
            return;
        }

        if (action === "read") {
            await openPdfReader(doc, url);
        }
    });
}

async function openPublicStudentProfile(studentId) {
    const profilePage = getElement("publicStudentProfilePage");
    const nameElement = getElement("publicStudentName");
    const avatarImage = getElement("publicStudentAvatar");
    const avatarFallback = getElement("publicStudentAvatarFallback");
    const joinedElement = getElement("publicStudentJoined");
    const pdfContainer = getElement("publicStudentPDFs");
    const statusElement = getElement("publicStudentProfileStatus");

    if (!profilePage) {
        alert("Student profile screen could not be found.");
        return;
    }

    if (nameElement) nameElement.textContent = "Loading profile...";
    if (joinedElement) joinedElement.textContent = "";
    if (pdfContainer) pdfContainer.innerHTML = "<p>Loading study materials...</p>";
    if (statusElement) statusElement.textContent = "";

    if (avatarImage) {
        avatarImage.hidden = true;
        avatarImage.removeAttribute("src");
    }

    if (avatarFallback) avatarFallback.hidden = false;

    Object.keys(pages).forEach(function (key) {
        if (pages[key]) pages[key].hidden = true;
    });

    profilePage.hidden = false;
    profilePage.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
        const { data: student, error: profileError } = await db
            .from("student_public_profiles")
            .select("id, full_name, display_name, avatar_url, created_at")
            .eq("id", studentId)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!student) {
            if (nameElement) nameElement.textContent = "GRADE X Student";
            if (pdfContainer) {
                pdfContainer.innerHTML = "<p>Student profile not found.</p>";
            }
            return;
        }

        if (nameElement) {
            nameElement.textContent =
                student.display_name ||
                student.full_name ||
                "GRADE X Student";
        }

        if (student.avatar_url && avatarImage) {
            avatarImage.src = student.avatar_url;
            avatarImage.hidden = false;

            if (avatarFallback) avatarFallback.hidden = true;
        }

                if (student.created_at && joinedElement) {
            joinedElement.textContent =
                "Joined " +
                new Date(student.created_at).toLocaleDateString();
        }
        await loadProfileFollowStats(studentId, "publicStudentFollowerCount", "publicStudentFollowingCount");
        await setupPublicStudentFollow(studentId);


        const { data: studentPDFs, error: pdfError } = await db
            .from("published_pdfs_with_authors")
            .select("id, title, subject, description, file_size, uploader_id, storage_path, original_filename, created_at")
            .eq("uploader_id", studentId)
            .order("created_at", { ascending: false });

        if (pdfError) throw pdfError;

        if (!studentPDFs || studentPDFs.length === 0) {
            if (pdfContainer) {
                pdfContainer.innerHTML =
                    "<p>This student hasn't published any PDFs yet.</p>";
            }
            return;
        }

        if (pdfContainer) {
            pdfContainer.innerHTML = studentPDFs.map(function (doc) {
                return `
                    <article class="pdf-card">
                        <div class="pdf-icon">📕</div>
                        <h3>${escapeHTML(doc.title || "Untitled PDF")}</h3>
                        <p>📘 ${escapeHTML(doc.subject || "General")}</p>
                        <p>${escapeHTML(doc.description || "Study material")}</p>
                        <p>${formatFileSize(doc.file_size || 0)}</p>

                        <div class="pdf-actions">
                            <button type="button"
                                class="secondary-btn"
                                data-action="public-read"
                                data-id="${escapeHTML(doc.id)}">
                                Read
                            </button>

                            <button type="button"
                                class="secondary-btn"
                                data-action="public-download"
                                data-id="${escapeHTML(doc.id)}">
                                Download
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }
    } catch (error) {
        console.error("Public student profile error:", error);

        if (pdfContainer) {
            pdfContainer.innerHTML =
                "<p>Couldn't load this student's study materials. Please try again.</p>";
        }

        if (statusElement) {
            statusElement.textContent =
                error.message || "An error occurred.";
        }
    }
}

const closePublicStudentProfileBtn =
    getElement("closePublicStudentProfileBtn");

if (closePublicStudentProfileBtn) {
    closePublicStudentProfileBtn.addEventListener("click", function () {
        const profilePage = getElement("publicStudentProfilePage");

        if (profilePage) profilePage.hidden = true;

        Object.keys(pages).forEach(function (key) {
            if (pages[key]) pages[key].hidden = key !== "library";
        });

        if (pages.library) {
            pages.library.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}

const publicStudentPDFs = getElement("publicStudentPDFs");

if (publicStudentPDFs) {
    publicStudentPDFs.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const action = button.dataset.action;
        const documentId = button.dataset.id;

        let doc = documents.find(function (item) {
            return String(item.id) === String(documentId);
        });

        if (!doc) {
            const { data, error } = await db
                .from("published_pdfs_with_authors")
                .select("id, title, subject, description, file_size, uploader_id, storage_path, original_filename")
                .eq("id", documentId)
                .maybeSingle();

            if (error || !data) {
                alert("This PDF could not be found.");
                return;
            }

            doc = data;
        }

        const url = getPublicPdfUrl(doc.storage_path);

        if (action === "public-read") {
            await openPdfReader(doc, url);
            return;
        }

        if (action === "public-download") {
            const link = document.createElement("a");

            link.href = url;
            link.download = doc.original_filename || "document.pdf";
            link.target = "_blank";
            link.rel = "noopener noreferrer";

            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    });
}


// ============================================
// PDF READER
// ============================================

async function openPdfReader(doc, url) {
    if (!window.pdfjsLib) {
        alert("The PDF reader could not load. Check your internet connection.");
        return;
    }

    currentPdfUrl = url;

    pdfReader.hidden = false;
    readerTitle.textContent = doc.title || "PDF document";

    readerPages.innerHTML = "<p>Loading PDF pages...</p>";

    pdfReader.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    try {
        const loadingTask = pdfjsLib.getDocument({ url });
        const pdf = await loadingTask.promise;

        if (currentPdfUrl !== url) return;

        readerPages.innerHTML = "";

        const pagesToRender = Math.min(pdf.numPages, 10);

        for (
            let pageNumber = 1;
            pageNumber <= pagesToRender;
            pageNumber++
        ) {
            if (currentPdfUrl !== url) return;

            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.2 });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            canvas.setAttribute(
                "aria-label",
                "PDF page " + pageNumber
            );

            readerPages.appendChild(canvas);

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        }

        if (pdf.numPages > pagesToRender) {
            const note = document.createElement("p");

            note.textContent =
                "Showing the first 10 pages. Download the PDF to read the remaining " +
                (pdf.numPages - pagesToRender) +
                " pages.";

            readerPages.appendChild(note);
        }
    } catch (error) {
        console.error("PDF reader error:", error);

        readerPages.innerHTML = `
            <p>Unable to display this PDF inside the app.</p>
            <p>${escapeHTML(error.message)}</p>
            <a href="${escapeHTML(url)}"
               target="_blank"
               rel="noopener noreferrer">
               Open PDF in browser
            </a>
        `;
    }
}

if (closeReader) {
    closeReader.addEventListener("click", function () {
        currentPdfUrl = null;
        pdfReader.hidden = true;
        readerPages.innerHTML = "";
    });
}


// ============================================
// 13. GRADE BOT
// ============================================

const chatForm = getElement("chatForm");
const chatInput = getElement("chatInput");
const chatMessages = getElement("chatMessages");
const botPDF = getElement("botPDF");
const botPDFStatus = getElement("botPDFStatus");

async function extractPdfText(doc) {
    if (!window.pdfjsLib) {
        throw new Error(
            "PDF reader is unavailable. Please refresh the app."
        );
    }

    const url = getPublicPdfUrl(doc.storage_path);
    const loadingTask = pdfjsLib.getDocument({ url });
    const pdf = await loadingTask.promise;

    let extractedText = "";
    const maxPages = Math.min(pdf.numPages, 30);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
            .map(function (item) {
                return item.str || "";
            })
            .join(" ");

        extractedText +=
            "\n[Page " + pageNumber + "]\n" + pageText;

        if (extractedText.length >= 24000) {
            extractedText = extractedText.slice(0, 24000);
            break;
        }
    }

    if (!extractedText.trim()) {
        throw new Error(
            "No selectable text was found in this PDF. It may be a scanned document."
        );
    }

    return extractedText;
}

if (chatForm && chatInput && chatMessages) {
    chatForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const question = chatInput.value.trim();

        if (!question) return;

        const selectedPdfId = botPDF ? botPDF.value : "";

        const selectedPdf = documents.find(function (doc) {
            return String(doc.id) === String(selectedPdfId);
        });

        const userMessage = document.createElement("div");
        userMessage.className = "user-message";
        userMessage.textContent = question;
        chatMessages.appendChild(userMessage);

        const botMessage = document.createElement("div");
        botMessage.className = "bot-message";
        botMessage.textContent = "GRADE BOT is thinking... 🤖";
        chatMessages.appendChild(botMessage);

        chatInput.value = "";
        chatInput.disabled = true;

        if (botPDF) botPDF.disabled = true;

        chatMessages.scrollTop = chatMessages.scrollHeight;

        let pdfContext = "";

        try {
            if (selectedPdf) {
                showMessage(
                    botPDFStatus,
                    "Extracting text from your PDF..."
                );

                pdfContext = await extractPdfText(selectedPdf);

                // SPEED BOOST: Trim context to roughly 8,000 characters max
                if (pdfContext.length > 8000) {
                    pdfContext = pdfContext.slice(0, 8000) + "\n[Content truncated for speed]";
                }

                showMessage(
                    botPDFStatus,
                    "Studying: " + selectedPdf.title
                );
            } else {
                if (botPDFStatus) {
                    botPDFStatus.textContent =
                        "General questions (no PDF selected)";
                }
            }

            const { data, error } = await db.functions.invoke(
                "dynamic-function",
                {
                    body: {
                        question: question,
                        pdfContext: pdfContext,
                        pdfTitle: selectedPdf ? selectedPdf.title : ""
                    }
                }
            );

            if (error) {
                console.error("GRADE BOT connection error:", error);

                throw new Error(
                    "Couldn't connect to GRADE BOT. Please try again."
                );
            }

            if (!data || !data.answer) {
                throw new Error(
                    data?.error || "GRADE BOT returned no answer."
                );
            }

            botMessage.textContent = data.answer;
        } catch (error) {
            console.error("GRADE BOT error:", error);

            botMessage.textContent =
                error.message ||
                "GRADE BOT couldn't respond. Please try again.";

            if (selectedPdf && botPDFStatus) {
                showMessage(
                    botPDFStatus,
                    "PDF question failed: " + error.message,
                    true
                );
            }
        } finally {
            chatInput.disabled = false;

            if (botPDF) botPDF.disabled = false;

            chatInput.focus();
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// ============================================
// 14. ARENA — FREE PRACTICE QUIZ
// ============================================

const quizQuestions = [
    {
        question: "What is the chemical symbol for water?",
        options: ["CO2", "H2O", "O2", "NaCl"],
        answer: 1
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: ["Venus", "Jupiter", "Mars", "Saturn"],
        answer: 2
    },
    {
        question: "What is 12 × 8?",
        options: ["86", "96", "108", "92"],
        answer: 1
    },
    {
        question: "Which gas do plants absorb during photosynthesis?",
        options: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"],
        answer: 3
    },
    {
        question: "What is the SI unit of force?",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        answer: 1
    },
    {
        question: "How many sides does a hexagon have?",
        options: ["Five", "Seven", "Six", "Eight"],
        answer: 2
    },
    {
        question: "What is the largest ocean on Earth?",
        options: [
            "Atlantic Ocean",
            "Indian Ocean",
            "Arctic Ocean",
            "Pacific Ocean"
        ],
        answer: 3
    },
    {
        question: "Which organ pumps blood around the human body?",
        options: ["Liver", "Heart", "Lungs", "Kidneys"],
        answer: 1
    },
    {
        question: "What is the approximate speed of light in a vacuum?",
        options: [
            "300,000 km/s",
            "30,000 km/s",
            "3,000 km/s",
            "150,000 km/s"
        ],
        answer: 0
    },
    {
        question: "What is the main natural source of energy for Earth?",
        options: ["The Moon", "The Sun", "Wind", "Coal"],
        answer: 1
    }
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const startQuiz = getElement("startQuiz");
const quizArea = getElement("quizArea");
const quizProgress = getElement("quizProgress");
const quizQuestion = getElement("quizQuestion");
const quizOptions = getElement("quizOptions");
const quizFeedback = getElement("quizFeedback");
const nextQuestion = getElement("nextQuestion");

if (startQuiz) {
    startQuiz.addEventListener("click", function () {
        quizIndex = 0;
        quizScore = 0;
        quizAnswered = false;

        if (quizArea) quizArea.hidden = false;

        startQuiz.hidden = true;
        startQuiz.textContent = "Start Quiz";

        showQuizQuestion();

        if (quizArea) {
            quizArea.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
}

function showQuizQuestion() {
    quizAnswered = false;

    const question = quizQuestions[quizIndex];

    quizProgress.textContent =
        "QUESTION " + (quizIndex + 1) +
        " OF " + quizQuestions.length;

    quizQuestion.textContent = question.question;
    quizOptions.innerHTML = "";
    quizFeedback.textContent = "";
    nextQuestion.hidden = true;

    question.options.forEach(function (option, index) {
        const button = document.createElement("button");

        button.className = "quiz-option";
        button.textContent = option;

        button.addEventListener("click", function () {
            answerQuizQuestion(index);
        });

        quizOptions.appendChild(button);
    });
}

function answerQuizQuestion(selectedIndex) {
    if (quizAnswered) return;

    quizAnswered = true;

    const question = quizQuestions[quizIndex];
    const buttons = quizOptions.querySelectorAll("button");

    buttons.forEach(function (button, index) {
        button.disabled = true;

        if (index === question.answer) {
            button.classList.add("correct");
        }
    });

    if (selectedIndex === question.answer) {
        quizScore++;

        quizFeedback.textContent = "Correct! Great job. 🎉";
        quizFeedback.style.color = "#4ade80";
    } else {
        buttons[selectedIndex].classList.add("incorrect");

        quizFeedback.textContent =
            "Not quite! The correct answer is: " +
            question.options[question.answer];

        quizFeedback.style.color = "#fb7185";
    }

    nextQuestion.hidden = false;

    nextQuestion.textContent =
        quizIndex === quizQuestions.length - 1
            ? "View Results"
            : "Next Question";
}

if (nextQuestion) {
    nextQuestion.addEventListener("click", function () {
        if (!quizAnswered) return;

        quizIndex++;

        if (quizIndex < quizQuestions.length) {
            showQuizQuestion();
            return;
        }

        quizProgress.textContent = "CHALLENGE COMPLETED";

        quizQuestion.textContent =
            "You scored " + quizScore +
            " out of " + quizQuestions.length + "!";

        quizOptions.innerHTML = "";

        quizFeedback.textContent =
            quizScore >= 8
                ? "Excellent work! 🏆"
                : quizScore >= 5
                    ? "Good effort! Keep practising. 💪"
                    : "Keep learning and try again! 📚";

        quizFeedback.style.color = "#36e4f5";

        nextQuestion.hidden = true;
        startQuiz.hidden = false;
        startQuiz.textContent = "Play Again";
    });
}


// ============================================
// 15. EDIT STUDENT PROFILE
// ============================================

const profileNameInput = getElement("profileNameInput");
const profileUsernameInput = getElement("profileUsernameInput");
const profileBioInput = getElement("profileBioInput");
const profileNameDisplay = getElement("profileName");
const profileEmailDisplay = getElement("profileEmail");
const profilePictureInput = getElement("profilePictureInput");
const profileAvatarImage = getElement("profileAvatarImage");
const profileAvatarFallback = getElement("profileAvatarFallback");
const saveProfileBtn = getElement("saveProfileBtn");
const profileStatus = getElement("profileStatus");

let selectedProfilePicture = null;
let profilePreviewUrl = null;

function renderProfile() {
    if (!currentUser) return;

    const metadata = currentUser.user_metadata || {};
    const displayName = metadata.display_name || "GRADE X Student";
    const avatarUrl = metadata.avatar_url || "";
        if (avatarUrl && profileAvatarImage) {
        profileAvatarImage.src = avatarUrl;
        profileAvatarImage.hidden = false;

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = true;
        }
    } else {
        if (profileAvatarImage) {
            profileAvatarImage.removeAttribute("src");
            profileAvatarImage.hidden = true;
        }

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = false;
        }
    }

    if (profileStatus) profileStatus.textContent = "";

    // ADD THIS RIGHT HERE:
    if (currentUser && currentUser.id) {
        loadProfileFollowStats(currentUser.id, "gxProfileFollowerCount", "gxProfileFollowingCount");
    }

    if (profileNameDisplay) {
        profileNameDisplay.textContent = displayName;
    }

    if (profileEmailDisplay) {
        profileEmailDisplay.textContent = currentUser.email || "";
    }

    if (profileNameInput) {
        profileNameInput.value = metadata.display_name || "";
    }

    if (profileUsernameInput) {
        profileUsernameInput.value = "";
        profileUsernameInput.dataset.userId = currentUser.id;

        db.from("student_public_profiles")
            .select("username, bio")
            .eq("id", currentUser.id)
            .maybeSingle()
            .then(function ({ data, error }) {
                if (error) {
                    console.error("Username load error:", error.message);
                    return;
                }

                if (
                    currentUser &&
                    currentUser.id === profileUsernameInput.dataset.userId
                ) {
                    profileUsernameInput.value = data?.username || "";
                    if (profileBioInput) {
                        profileBioInput.value = data?.bio || "";
                    }
                }
            })
            .catch(function (error) {
                console.error("Username request error:", error);
            });
    }

    if (profilePreviewUrl) {
        URL.revokeObjectURL(profilePreviewUrl);
        profilePreviewUrl = null;
    }

    selectedProfilePicture = null;

    if (profilePictureInput) {
        profilePictureInput.value = "";
    }

    if (avatarUrl && profileAvatarImage) {
        profileAvatarImage.src = avatarUrl;
        profileAvatarImage.hidden = false;

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = true;
        }
    } else {
        if (profileAvatarImage) {
            profileAvatarImage.removeAttribute("src");
            profileAvatarImage.hidden = true;
        }

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = false;
        }
    }

    if (profileStatus) profileStatus.textContent = "";
}

if (profileAvatarImage) {
    profileAvatarImage.addEventListener("error", function () {
        profileAvatarImage.hidden = true;

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = false;
        }
    });
}

if (profilePictureInput) {
    profilePictureInput.addEventListener("change", function () {
        const file = profilePictureInput.files[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            showMessage(
                profileStatus,
                "Please select a JPG, PNG, WEBP, or GIF image.",
                true
            );

            profilePictureInput.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage(
                profileStatus,
                "Image must be 5 MB or smaller.",
                true
            );

            profilePictureInput.value = "";
            return;
        }

        selectedProfilePicture = file;

        if (profilePreviewUrl) {
            URL.revokeObjectURL(profilePreviewUrl);
        }

        profilePreviewUrl = URL.createObjectURL(file);

        if (profileAvatarImage) {
            profileAvatarImage.src = profilePreviewUrl;
            profileAvatarImage.hidden = false;
        }

        if (profileAvatarFallback) {
            profileAvatarFallback.hidden = true;
        }

        showMessage(
            profileStatus,
            "Photo selected. Tap Save Changes."
        );
    });
}

if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async function () {
        if (!currentUser) {
            showMessage(profileStatus, "Please sign in first.", true);
            return;
        }

                const displayName = profileNameInput
            ? profileNameInput.value.trim()
            : "";

        let usernameInput = profileUsernameInput
            ? profileUsernameInput.value.trim().toLowerCase()
            : "";
        const bioInput = profileBioInput ?
            profileBioInput.value.trim() :
            "";

        if (!displayName) {
            showMessage(
                profileStatus,
                "Please enter your display name.",
                true
            );
            return;
        }

        // AUTO-GENERATE USERNAME IF BLANK
        if (!usernameInput) {
            const emailPrefix = currentUser.email 
                ? currentUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') 
                : 'student';
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            usernameInput = `${emailPrefix}_${randomSuffix}`.slice(0, 20);
        }


        if (
            usernameInput &&
            !/^[a-z0-9_]{3,20}$/.test(usernameInput)
        ) {
            showMessage(
                profileStatus,
                "Username must be 3–20 characters using letters, numbers, or underscores.",
                true
            );
            return;
        }

        saveProfileBtn.disabled = true;

        showMessage(profileStatus, "Saving your profile...");

        try {
            let avatarUrl =
                currentUser.user_metadata?.avatar_url || "";

            if (selectedProfilePicture) {
                const file = selectedProfilePicture;

                const extensions = {
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "image/webp": "webp",
                    "image/gif": "gif"
                };

                const extension = extensions[file.type];

                if (!extension) {
                    throw new Error(
                        "Please use a JPG, PNG, WEBP, or GIF image."
                    );
                }

                const storagePath =
                    currentUser.id +
                    "/profile_" +
                    crypto.randomUUID() +
                    "." +
                    extension;

                const { error: uploadError } = await db.storage
                    .from(BUCKET_NAME)
                    .upload(storagePath, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: publicData } = db.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(storagePath);

                avatarUrl = publicData.publicUrl;
            }

            const { data, error } = await db.auth.updateUser({
                data: {
                    display_name: displayName,
                    avatar_url: avatarUrl
                }
            });

            if (error) throw error;

            const { error: profileError } = await db
                .from("profiles")
                .upsert({
                    id: currentUser.id,
                    full_name: displayName,
                    email: currentUser.email,
                    display_name: displayName,
                    avatar_url: avatarUrl
                }, {
                    onConflict: "id"
                });

            if (profileError) throw profileError;

            const publicProfile = {
                id: currentUser.id,
                full_name: displayName,
                display_name: displayName,
                avatar_url: avatarUrl,
                username: usernameInput || null,
                bio: bioInput
            };

            const { error: publicProfileError } = await db
                .from("student_public_profiles")
                .upsert(publicProfile, {
                    onConflict: "id"
                });

            if (publicProfileError) throw publicProfileError;

            if (data.user) {
                currentUser = data.user;
            }

            renderProfile();

            showMessage(
                profileStatus,
                "Profile saved successfully! ✅"
            );
        } catch (error) {
            console.error("Profile save error:", error);

            showMessage(
                profileStatus,
                "Could not save: " + error.message,
                true
            );
        } finally {
            saveProfileBtn.disabled = false;
        }
    });
}


// ============================================
// 16. START THE APP
// ============================================

restoreSession().catch(function (error) {
    console.error("GRADE X startup error:", error);

    showMessage(
        authStatus,
        "GRADE X couldn't restore your session. Refresh the app and try again.",
        true
    );
});

console.log("GRADE X application initialized.");


// ============================================
// GRADE X MENU BUTTON
// ============================================

const menuBtn = getElement("menuBtn");

if (menuBtn) {
    menuBtn.addEventListener("click", function () {
        const menu = getElement("menuPanel");

        if (menu) {
            menu.hidden = !menu.hidden;
        } else {
            console.log("GRADE X: Menu panel not found.");
        }
    });
}

/* ============================================
   GRADE X SOCIAL — MEDIA PREVIEW
============================================ */

(function initGXSocialMediaPreview() {
    const mediaInput = document.getElementById("gxPostMedia");
    const previewBox = document.getElementById("gxPostMediaPreview");
    const imagePreview = document.getElementById("gxPostImagePreview");
    const videoPreview = document.getElementById("gxPostVideoPreview");

    if (!mediaInput || !previewBox || !imagePreview || !videoPreview) {
        return;
    }

    let previewUrl = null;

    mediaInput.addEventListener("change", function () {
        const file = mediaInput.files && mediaInput.files[0];

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        imagePreview.hidden = true;
        videoPreview.hidden = true;
        imagePreview.removeAttribute("src");
        videoPreview.removeAttribute("src");
        previewBox.hidden = true;

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm",
            "video/quicktime"
        ];

        if (!allowedTypes.includes(file.type)) {
            alert("Choose a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file.");
            mediaInput.value = "";
            return;
        }

        const isVideo = file.type.startsWith("video/");

        const maxSize = isVideo
            ? 50 * 1024 * 1024
            : 10 * 1024 * 1024;

        if (file.size > maxSize) {
            alert(
                isVideo
                    ? "Videos must be 50 MB or smaller."
                    : "Photos must be 10 MB or smaller."
            );

            mediaInput.value = "";
            return;
        }

        previewUrl = URL.createObjectURL(file);

        if (isVideo) {
            videoPreview.src = previewUrl;
            videoPreview.hidden = false;
        } else {
            imagePreview.src = previewUrl;
            imagePreview.hidden = false;
        }

        previewBox.hidden = false;
    });
})();

/* ============================================
   GRADE X SOCIAL — UPLOAD AND PUBLISH POSTS
============================================ */

(function initGXSocialPosting() {
    const form = document.getElementById("gxSocialPostForm");
    const mediaInput = document.getElementById("gxPostMedia");
    const captionInput = document.getElementById("gxPostCaption");
    const publishBtn = document.getElementById("gxPublishPostBtn");
    const statusBox = document.getElementById("gxPostStatus");
    const feed = document.getElementById("gxHomeSocialFeed");

    if (!form || !mediaInput || !captionInput || !publishBtn || !statusBox || !feed) {
        console.warn("GRADE X Social: posting form elements not found.");
        return;
    }

    const CLOUDINARY_URL =
        "https://api.cloudinary.com/v1_1/lmzznasm/auto/upload";

    const UPLOAD_PRESET = "gradex_social";

    function showPostStatus(message, isError) {
        statusBox.textContent = message;
        statusBox.style.color = isError ? "#ff6b81" : "#a78bfa";
    }

    function safeText(value) {
        if (typeof escapeHTML === "function") {
            return escapeHTML(String(value ?? ""));
        }

        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    async function loadGXSocialFeed() {
        feed.innerHTML = `
            <div class="empty-feed">
                <div class="empty-icon">💜</div>
                <h3>Loading community...</h3>
                <p>Please wait.</p>
            </div>
        `;

        const { data, error } = await db
            .from("social_posts")
            .select(`
                id,
                user_id,
                media_url,
                media_type,
                caption,
                created_at,
                profiles!social_posts_profile_fk (
                    display_name,
                    full_name,
                    avatar_url
                )
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Social feed error:", error);
            feed.innerHTML = `
                <div class="empty-feed">
                    <h3>Couldn't load posts</h3>
                    <p>Please check your connection and try again.</p>
                    <button type="button" id="gxRetryFeedBtn">Try Again</button>
                </div>
            `;

            const retryBtn = document.getElementById("gxRetryFeedBtn");
            if (retryBtn) {
                retryBtn.addEventListener("click", loadGXSocialFeed);
            }
            return;
        }

        if (!data || data.length === 0) {
            feed.innerHTML = `
                <div class="empty-feed">
                    <div class="empty-icon">💜</div>
                    <h3>No posts yet</h3>
                    <p>Be the first to share something with GRADE X students.</p>
                </div>
            `;
            return;
        }

        feed.innerHTML = data.map(function (post) {
            const profile = post.profiles || {};
            const author = profile.display_name ||
                profile.full_name ||
                "GRADE X Student";

            const caption = safeText(post.caption);
            const safeAuthor = safeText(author);
            const avatarUrl = profile.avatar_url || "";

            let avatar = `<div class="gx-social-avatar">👤</div>`;

            if (
                avatarUrl &&
                /^https:\/\//i.test(avatarUrl)
            ) {
                avatar = `
                    <img
                        class="gx-social-avatar"
                        src="${safeText(avatarUrl)}"
                        alt=""
                        loading="lazy"
                    >
                `;
            }

            let media = "";

            if (
                post.media_type === "image" &&
                /^https:\/\/res\.cloudinary\.com\/lmzznasm\//i.test(post.media_url)
            ) {
                media = `
                    <img
                        class="gx-social-post-media"
                        src="${safeText(post.media_url)}"
                        alt="Photo shared by ${safeAuthor}"
                        loading="lazy"
                    >
                `;
            } else if (
                post.media_type === "video" &&
                /^https:\/\/res\.cloudinary\.com\/lmzznasm\//i.test(post.media_url)
            ) {
                media = `
                    <video
                        class="gx-social-post-media gx-auto-play-video"
                        src="${safeText(post.media_url)}"
                        controls
                        playsinline
                        muted
                        loop
                        preload="metadata"
                    ></video>
                `;
            } else {
                media = `<p>Media unavailable.</p>`;
            }

            const date = post.created_at
                ? safeText(new Date(post.created_at).toLocaleDateString())
                : "";

            return `
                <article class="gx-social-post-card" data-post-id="${safeText(post.id)}">
                    <div class="gx-social-post-author">
                        ${avatar}
                        <div>
                            <strong>${safeAuthor}</strong>
                            <small>${date}</small>
                        </div>
                    </div>

                    ${media}

                    ${caption ? `<p class="gx-social-post-caption">${caption}</p>` : ""}

                    <div class="gx-social-post-actions">
                        <button
                            type="button"
                            class="gx-social-like-btn"
                            data-post-id="${safeText(post.id)}"
                            aria-label="Like post"
                        >♡ <span class="gx-social-like-count">0</span></button>

                        <button
                            type="button"
                            class="gx-social-comment-btn"
                            data-post-id="${safeText(post.id)}"
                        >💬 <span class="gx-social-comment-count">0</span> Comments</button>
                    </div>

                    <div class="gx-social-comments-area" data-post-id="${safeText(post.id)}"></div>
                </article>
            `;
        }).join("");

        await loadGXSocialCounts();
        setupGXSocialVideoPlayback();
    }

    let gxSocialVideoObserver = null;

    function setupGXSocialVideoPlayback() {
        if (gxSocialVideoObserver) {
            gxSocialVideoObserver.disconnect();
        }

        const videos = feed.querySelectorAll(".gx-auto-play-video");

        gxSocialVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const video = entry.target;

                if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        }, {
            threshold: [0, 0.6, 1]
        });

        videos.forEach((video) => {
            video.muted = true;
            gxSocialVideoObserver.observe(video);
        });
    }

    async function loadGXSocialCounts() {
        const cards = feed.querySelectorAll(".gx-social-post-card");

        for (const card of cards) {
            const postId = card.dataset.postId;

            const { count: likes, error: likeError } = await db
                .from("social_post_likes")
                .select("*", { count: "exact", head: true })
                .eq("post_id", postId);

            const { count: comments, error: commentError } = await db
                .from("social_post_comments")
                .select("*", { count: "exact", head: true })
                .eq("post_id", postId);

            if (!likeError) {
                const el = card.querySelector(".gx-social-like-count");
                if (el) el.textContent = likes ?? 0;
            }

            if (!commentError) {
                const el = card.querySelector(".gx-social-comment-count");
                if (el) el.textContent = comments ?? 0;
            }
        }
    }

    feed.addEventListener("click", async function (event) {
        const button = event.target.closest(".gx-social-like-btn");
        if (!button) return;

        if (!currentUser) {
            alert("Please sign in to like posts.");
            return;
        }

        const postId = button.dataset.postId;
        button.disabled = true;

        try {
            const { data: existing, error: checkError } = await db
                .from("social_post_likes")
                .select("post_id")
                .eq("post_id", postId)
                .eq("user_id", currentUser.id)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                const { error } = await db
                    .from("social_post_likes")
                    .delete()
                    .eq("post_id", postId)
                    .eq("user_id", currentUser.id);

                if (error) throw error;
            } else {
                const { error } = await db
                    .from("social_post_likes")
                    .insert({
                        post_id: postId,
                        user_id: currentUser.id
                    });

                if (error) throw error;
            }

            await loadGXSocialCounts();
        } catch (error) {
            console.error("Like error:", error);
            alert("Couldn't update your like. Please try again.");
        } finally {
            button.disabled = false;
        }
    });

    async function loadGXSocialComments(postId, area) {
        area.innerHTML = "<p>Loading comments...</p>";

        const { data, error } = await db
            .from("social_post_comments")
            .select("id, user_id, content, created_at")
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Loading comments failed:", error);
            area.innerHTML = "<p>Couldn't load comments. Please try again.</p>";
            return;
        }

        const userIds = [
            ...new Set((data || []).map(comment => comment.user_id).filter(Boolean))
        ];

        const profileById = {};

        if (userIds.length > 0) {
            const { data: profiles, error: profileError } = await db
                .from("profiles")
                .select("id, display_name, full_name, avatar_url")
                .in("id", userIds);

            if (!profileError && profiles) {
                profiles.forEach(profile => {
                    profileById[profile.id] = profile;
                });
            }
        }

        const commentsHTML = (data || []).map(function (comment) {
            const profile = profileById[comment.user_id] || {};

            const author = safeText(
                profile.display_name ||
                profile.full_name ||
                "GRADE X Student"
            );

            let avatar = `
                <div class="gx-social-comment-avatar gx-social-comment-avatar-fallback">
                    👤
                </div>
            `;

            if (
                profile.avatar_url &&
                /^https:\/\//i.test(profile.avatar_url)
            ) {
                avatar = `
                    <img
                        class="gx-social-comment-avatar"
                        src="${safeText(profile.avatar_url)}"
                        alt=""
                        loading="lazy"
                    >
                `;
            }

            const time = comment.created_at
                ? safeText(new Date(comment.created_at).toLocaleString())
                : "";

            return `
                <div class="gx-social-comment">
                    ${avatar}

                    <div class="gx-social-comment-body">
                        <div class="gx-social-comment-meta">
                            <strong>${author}</strong>
                            <small>${time}</small>
                        </div>

                        <p>${safeText(comment.content)}</p>
                    </div>
                </div>
            `;
        }).join("");

        area.innerHTML = `
            <div class="gx-social-comments-list">
                ${commentsHTML || "<p>No comments yet. Start the conversation!</p>"}
            </div>

            ${currentUser ? `
                <form class="gx-social-comment-form" data-post-id="${safeText(postId)}">
                    <input
                        type="text"
                        name="comment"
                        maxlength="2000"
                        placeholder="Write a comment..."
                        required
                    >
                    <button type="submit">Send</button>
                </form>
            ` : `
                <p>Sign in to write a comment.</p>
            `}
        `;
    }

    feed.addEventListener("click", async function (event) {
        const button = event.target.closest(".gx-social-comment-btn");
        if (!button) return;

        const postId = button.dataset.postId;
        const area = feed.querySelector(
            '.gx-social-comments-area[data-post-id="' + postId + '"]'
        );

        if (!area) return;

        if (area.dataset.open === "true") {
            area.dataset.open = "false";
            area.innerHTML = "";
            return;
        }

        area.dataset.open = "true";
        await loadGXSocialComments(postId, area);
    });

    feed.addEventListener("submit", async function (event) {
        const commentForm = event.target.closest(".gx-social-comment-form");
        if (!commentForm) return;

        event.preventDefault();

        if (!currentUser) {
            alert("Please sign in to comment.");
            return;
        }

        const postId = commentForm.dataset.postId;
        const input = commentForm.querySelector('[name="comment"]');
        const content = input.value.trim();

        if (!content) return;

        const sendButton = commentForm.querySelector('button[type="submit"]');
        sendButton.disabled = true;

        try {
            const { error } = await db
                .from("social_post_comments")
                .insert({
                    post_id: postId,
                    user_id: currentUser.id,
                    content: content
                });

            if (error) throw error;

            const area = feed.querySelector(
                '.gx-social-comments-area[data-post-id="' + postId + '"]'
            );

            if (area) {
                await loadGXSocialComments(postId, area);
            }

            await loadGXSocialCounts();
        } catch (error) {
            console.error("Posting comment failed:", error);
            alert("Couldn't send your comment. Please try again.");
            sendButton.disabled = false;
        }
    });

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser) {
            showPostStatus("Please sign in before publishing.", true);
            return;
        }

        const file = mediaInput.files && mediaInput.files[0];

        if (!file) {
            showPostStatus("Choose a photo or video first.", true);
            return;
        }

        const isVideo = file.type.startsWith("video/");

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm",
            "video/quicktime"
        ];

        if (!allowedTypes.includes(file.type)) {
            showPostStatus("That file type is not supported.", true);
            return;
        }

        const maxSize = isVideo
            ? 50 * 1024 * 1024
            : 10 * 1024 * 1024;

        if (file.size > maxSize) {
            showPostStatus(
                isVideo
                    ? "Videos must be 50 MB or smaller."
                    : "Photos must be 10 MB or smaller.",
                true
            );
            return;
        }

        const caption = captionInput.value.trim();

        publishBtn.disabled = true;
        showPostStatus("Uploading your media...", false);

        try {
            const uploadData = new FormData();
            uploadData.append("file", file);
            uploadData.append("upload_preset", UPLOAD_PRESET);

            const uploadResponse = await fetch(CLOUDINARY_URL, {
                method: "POST",
                body: uploadData
            });

            const uploadResult = await uploadResponse.json();

            if (!uploadResponse.ok || !uploadResult.secure_url) {
                console.error("Cloudinary upload failed:", uploadResult);
                throw new Error(
                    uploadResult.error?.message || "Media upload failed."
                );
            }

            showPostStatus("Media uploaded. Publishing your post...", false);

            const mediaUrl = uploadResult.secure_url;
            const mediaHostIsValid =
                /^https:\/\/res\.cloudinary\.com\/lmzznasm\//i.test(mediaUrl);

            if (!mediaHostIsValid) {
                throw new Error("The uploaded media URL could not be verified.");
            }

            const { error: insertError } = await db
                .from("social_posts")
                .insert({
                    user_id: currentUser.id,
                    media_url: mediaUrl,
                    media_type: isVideo ? "video" : "image",
                    caption: caption
                });

            if (insertError) {
                console.error("Saving social post failed:", insertError);
                throw new Error(insertError.message);
            }

            form.reset();
            mediaInput.dispatchEvent(new Event("change"));

            showPostStatus("Post published successfully! 💜", false);

            await loadGXSocialFeed();

        } catch (error) {
            console.error("GRADE X Social publish error:", error);
            showPostStatus(
                error.message || "Couldn't publish your post. Please try again.",
                true
            );
        } finally {
            publishBtn.disabled = false;
        }
    });

    loadGXSocialFeed();

    db.auth.onAuthStateChange(function (_event, session) {
        if (session && session.user) {
            loadGXSocialFeed();
        }
    });
})();

/* ==========================================
   GRADE X — LOAD MY PROFILE POSTS
========================================== */

async function loadGXProfilePosts() {
    const grid = document.getElementById("gxProfilePostsGrid");
    const postCount = document.getElementById("gxProfilePostCount");

    if (!grid || !currentUser) return;

    grid.innerHTML = '<div class="empty-feed"><p>Loading your posts...</p></div>';

    const { data, error } = await db
        .from("social_posts")
        .select("id, media_url, media_type, caption, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Could not load profile posts:", error);
        grid.innerHTML = '<div class="empty-feed"><p>Could not load your posts. Please try again.</p></div>';
        return;
    }

    if (postCount) {
        postCount.textContent = data.length;
    }

    if (!data.length) {
        grid.innerHTML = '<div class="empty-feed"><p>You have not shared any posts yet.</p></div>';
        return;
    }

    grid.innerHTML = data.map(function(post) {
        const mediaUrl = String(post.media_url || "");
        const safeUrl = mediaUrl.startsWith("https://res.cloudinary.com/lmzznasm/")
            ? mediaUrl
            : "";

        if (!safeUrl) return "";

        const isVideo = post.media_type === "video";

        return `
            <div class="gx-profile-post-item" data-post-id="${post.id}">
                ${
                    isVideo
                        ? `<video
                               src="${safeUrl}"
                               muted
                               playsinline
                               preload="auto"
                               controls
                               style="width:100%;height:100%;object-fit:cover;background:#111;"
                           ></video>`
                        : `<img src="${safeUrl}" alt="Your post" loading="lazy">`
                }
            </div>
        `;
    }).join("");

    if (!grid.innerHTML.trim()) {
        grid.innerHTML = '<div class="empty-feed"><p>No displayable posts found.</p></div>';
    }
}

(function setupGXProfilePostsLoader() {
    const profile = document.getElementById("gxProfileView");

    if (!profile) return;

    const observer = new MutationObserver(function() {
        if (!profile.hidden && currentUser) {
            loadGXProfilePosts();
        }
    });

    observer.observe(profile, {
        attributes: true,
        attributeFilter: ["hidden", "class", "style"]
    });
})();

/* ==========================================
   GRADE X ARENA — PRIVATE MESSAGING
========================================== */
(function () {
  "use strict";

  const el = id => document.getElementById(id);

  const search = el("gxDMSearch");
  const results = el("gxDMStudentResults");
  const conversationList = el("gxDMConversationList");
  const chatHeader = el("gxDMChatHeader");
  const messagesBox = el("gxDMMessages");
  const composeForm = el("gxDMComposeForm");
  const messageInput = el("gxDMMessageInput");
  const sendButton = el("gxDMSendButton");
  const newChatButton = el("gxDMNewChat");

  if (
    !search || !results || !conversationList ||
    !chatHeader || !messagesBox || !composeForm
  ) {
    console.warn("GRADE X DM: Messages HTML elements not found.");
    return;
  }

  let activeConversation = null;
  let conversations = [];
  let activeFilter = "chats";
  let searchTimer = null;
  let loadingMessages = false;

  const tabs = document.createElement("div");
  tabs.className = "gx-dm-tabs";

  [
    { id: "chats", label: "Chats" },
    { id: "requests", label: "Requests" }
  ].forEach(function (item) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.dataset.dmFilter = item.id;

    button.addEventListener("click", function () {
      activeFilter = item.id;
      tabs.querySelectorAll("button").forEach(function (tab) {
        tab.classList.toggle("active", tab === button);
      });
      renderConversationList();
    });

    tabs.appendChild(button);
  });

  conversationList.parentNode.insertBefore(
    tabs,
    conversationList
  );

  function getOtherUser(conversation) {
    return conversation.user_a === currentUser.id
      ? conversation.user_b
      : conversation.user_a;
  }

  function isIncomingRequest(conversation) {
    return conversation.request_status === "pending" &&
      conversation.initiated_by !== currentUser.id;
  }

  function isVisibleInFilter(conversation) {
    if (activeFilter === "requests") {
      return isIncomingRequest(conversation);
    }

    return conversation.request_status === "accepted" ||
      (
        conversation.request_status === "pending" &&
        conversation.initiated_by === currentUser.id
      );
  }

  function studentName(student) {
    if (!student) return "GRADE X Student";

    return student.display_name ||
      student.full_name ||
      (student.username ? "@" + student.username : "GRADE X Student");
  }

  function studentHandle(student) {
    return student && student.username
      ? "@" + student.username
      : "GRADE X student";
  }

  function makeAvatar(student) {
    const avatar = document.createElement("div");
    avatar.className = "gx-dm-avatar";

    if (student && student.avatar_url) {
      const image = document.createElement("img");
      image.src = student.avatar_url;
      image.alt = "";
      image.onerror = function () {
        avatar.textContent = "👤";
      };
      avatar.appendChild(image);
    } else {
      avatar.textContent = "👤";
    }

    return avatar;
  }

  function showStatus(container, message) {
    container.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.className = "gx-dm-status";
    paragraph.textContent = message;
    container.appendChild(paragraph);
  }

  async function searchStudents(query) {
    if (!currentUser) return;

    query = query.trim().replace(/^@/, "");

    if (query.length < 2) {
      results.hidden = true;
      results.replaceChildren();
      return;
    }

    results.hidden = false;
    showStatus(results, "Searching students...");

    const { data, error } = await db.rpc(
      "gx_search_chat_students",
      { p_query: query }
    );

    if (error) {
      console.error("GX student search:", error);
      showStatus(results, "Could not search students. Please try again.");
      return;
    }

    results.replaceChildren();

    if (!data || data.length === 0) {
      showStatus(results, "No students found. Check the username and try again.");
      return;
    }

    data.forEach(function (student) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gx-dm-student-result";

      const avatar = makeAvatar(student);
      const details = document.createElement("span");
      details.className = "gx-dm-student-details";

      const name = document.createElement("strong");
      name.textContent = studentName(student);

      const handle = document.createElement("small");
      handle.textContent = studentHandle(student);

      details.append(name, handle);
      button.append(avatar, details);

      button.addEventListener("click", function () {
        startConversation(student);
      });

      results.appendChild(button);
    });
  }

  async function startConversation(student) {
    if (!currentUser || !student || !student.id) return;

    results.hidden = false;
    showStatus(results, "Opening conversation...");

    const { data, error } = await db.rpc(
      "gx_start_conversation",
      { p_other_user: student.id }
    );

    if (error) {
      console.error("GX start conversation:", error);
      showStatus(results, error.message || "Could not start this conversation.");
      return;
    }

    results.hidden = true;
    search.value = "";

    await loadConversations();

    const conversationId = typeof data === "string"
      ? data
      : data && data.id;

    if (conversationId) {
      await openConversation(conversationId);
    }
  }

  async function loadConversations() {
    if (!currentUser) return;

    conversationList.replaceChildren();
    showStatus(conversationList, "Loading conversations...");

    const { data, error } = await db
      .from("gx_conversations")
      .select("*")
      .or(
        "user_a.eq." + currentUser.id +
        ",user_b.eq." + currentUser.id
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GX load conversations:", error);
      showStatus(conversationList, "Could not load conversations.");
      return;
    }

    conversations = data || [];
    await renderConversationList();
  }

  async function renderConversationList() {
    conversationList.replaceChildren();

    const visible = conversations.filter(isVisibleInFilter);

    const requestCount = conversations.filter(isIncomingRequest).length;
    const requestTab = tabs.querySelector('[data-dm-filter="requests"]');

    if (requestTab) {
      requestTab.textContent = requestCount
        ? "Requests (" + requestCount + ")"
        : "Requests";
    }

    if (visible.length === 0) {
      showStatus(
        conversationList,
        activeFilter === "requests"
          ? "No new message requests."
          : "No chats yet. Search for a student to start a conversation."
      );
      return;
    }

    const studentIds = [...new Set(visible.map(getOtherUser))];

    const { data: students, error } = await db
      .from("student_public_profiles")
      .select("id,full_name,display_name,username,avatar_url")
      .in("id", studentIds);

    if (error) {
      console.error("GX load student names:", error);
      showStatus(conversationList, "Could not load student profiles.");
      return;
    }

    const studentMap = new Map(
      (students || []).map(student => [student.id, student])
    );

    visible.forEach(function (conversation) {
      const student = studentMap.get(getOtherUser(conversation));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gx-dm-conversation";
      button.classList.toggle(
        "active",
        conversation.id === activeConversation
      );

      const avatar = makeAvatar(student);
      const details = document.createElement("span");
      details.className = "gx-dm-student-details";

      const name = document.createElement("strong");
      name.textContent = studentName(student);

      const handle = document.createElement("small");

      if (isIncomingRequest(conversation)) {
        handle.textContent = "New message request";
      } else if (conversation.request_status === "pending") {
        handle.textContent = "Request sent — awaiting response";
      } else {
        handle.textContent = studentHandle(student);
      }

      details.append(name, handle);
      button.append(avatar, details);

      button.addEventListener("click", function () {
        openConversation(conversation.id);

        const messagesView = document.getElementById("gxMessagesView");

        if (messagesView) {
          messagesView.classList.add("gx-dm-chat-open");
        }
      });

      conversationList.appendChild(button);
    });
  }

  async function openConversation(conversationId) {
    if (!currentUser) return;

    const conversation = conversations.find(
      item => item.id === conversationId
    );

    if (!conversation) {
      await loadConversations();
      return;
    }

    activeConversation = conversationId;

    const otherId = getOtherUser(conversation);

    const { data: student, error } = await db
      .from("student_public_profiles")
      .select("id,full_name,display_name,username,avatar_url")
      .eq("id", otherId)
      .maybeSingle();

    if (error) {
      console.error("GX open student profile:", error);
    }

    chatHeader.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "gx-dm-header-person";
    heading.appendChild(makeAvatar(student));

    const personDetails = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = studentName(student);

    const handle = document.createElement("p");
    handle.textContent = studentHandle(student);

    personDetails.append(name, handle);
    heading.appendChild(personDetails);
    chatHeader.appendChild(heading);

    const incoming = isIncomingRequest(conversation);

    if (incoming) {
      const requestNote = document.createElement("p");
      requestNote.className = "gx-dm-request-note";
      requestNote.textContent =
        "This student wants to message you. Accept the request to reply.";
      chatHeader.appendChild(requestNote);

      const actions = document.createElement("div");
      actions.className = "gx-dm-request-actions";

      [
        { label: "Accept", accept: true },
        { label: "Decline", accept: false }
      ].forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.className = item.accept
          ? "gx-dm-accept"
          : "gx-dm-decline";

        button.addEventListener("click", async function () {
          button.disabled = true;

          const { error } = await db.rpc(
            "gx_respond_message_request",
            {
              p_conversation_id: conversationId,
              p_accept: item.accept
            }
          );

          if (error) {
            console.error("GX respond to request:", error);
            window.alert(error.message || "Could not update the request.");
            button.disabled = false;
            return;
          }

          await loadConversations();

          if (item.accept) {
            await openConversation(conversationId);
          } else {
            activeConversation = null;
            resetChat();
          }
        });

        actions.appendChild(button);
      });

      chatHeader.appendChild(actions);
    }

    messageInput.disabled = incoming;
    sendButton.disabled = incoming;

    await loadMessages(conversationId);
    await renderConversationList();
  }

  async function loadMessages(conversationId) {
    if (!currentUser || loadingMessages) return;

    loadingMessages = true;
    messagesBox.replaceChildren();
    showStatus(messagesBox, "Loading messages...");

    const { data, error } = await db
      .from("gx_direct_messages")
      .select("id,conversation_id,sender_id,content,created_at,read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);

    loadingMessages = false;

    if (error) {
      console.error("GX load messages:", error);
      showStatus(messagesBox, "Could not load messages.");
      return;
    }

    messagesBox.replaceChildren();

    if (!data || data.length === 0) {
      showStatus(messagesBox, "No messages yet. Say hello!");
      return;
    }

    data.forEach(function (message) {
      const bubble = document.createElement("div");
      bubble.className = "gx-dm-bubble " +
        (
          message.sender_id === currentUser.id
            ? "gx-dm-bubble-outgoing"
            : "gx-dm-bubble-incoming"
        );

      const content = document.createElement("p");
      content.textContent = message.content;

      const time = document.createElement("small");
      time.textContent = new Date(message.created_at).toLocaleString(
        undefined,
        { hour: "2-digit", minute: "2-digit" }
      );

      bubble.append(content, time);
      messagesBox.appendChild(bubble);
    });

    messagesBox.scrollTop = messagesBox.scrollHeight;

    const unreadIds = data
      .filter(message =>
        message.sender_id !== currentUser.id && !message.read_at
      )
      .map(message => message.id);

    if (unreadIds.length) {
      const { error: readError } = await db
        .from("gx_direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (readError) {
        console.warn("GX mark messages read:", readError);
      }
    }
  }

  function resetChat() {
    chatHeader.replaceChildren();
    showStatus(chatHeader, "Select a conversation to start chatting.");
    showStatus(messagesBox, "Your private conversations will appear here.");
    messageInput.value = "";
    messageInput.disabled = false;
    sendButton.disabled = false;
  }

  composeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!currentUser || !activeConversation) {
      window.alert("Open a conversation first.");
      return;
    }

    const conversation = conversations.find(
      item => item.id === activeConversation
    );

    if (!conversation || isIncomingRequest(conversation)) {
      window.alert("Accept the message request before replying.");
      return;
    }

    const content = messageInput.value.trim();

    if (!content || content.length > 5000) return;

    sendButton.disabled = true;

    const { error } = await db
      .from("gx_direct_messages")
      .insert({
        conversation_id: activeConversation,
        sender_id: currentUser.id,
        content: content
      });

    sendButton.disabled = false;

    if (error) {
      console.error("GX send message:", error);
      window.alert(error.message || "Message could not be sent.");
      return;
    }

    messageInput.value = "";
    await loadMessages(activeConversation);
  });

  search.addEventListener("input", function () {
    window.clearTimeout(searchTimer);

    searchTimer = window.setTimeout(function () {
      searchStudents(search.value).catch(function (error) {
        console.error("GX student search failed:", error);
      });
    }, 350);
  });

  if (newChatButton) {
    newChatButton.addEventListener("click", function () {
      search.focus();
      search.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const messagesView = el("gxMessagesView");

  if (messagesView && window.MutationObserver) {
    let wasVisible = false;

    const observer = new MutationObserver(function () {
      const isVisible = !messagesView.hidden;

      if (isVisible && !wasVisible && currentUser) {
        loadConversations();
      }

      wasVisible = isVisible;
    });

    observer.observe(messagesView, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  if (messagesView && !messagesView.hidden && currentUser) {
    loadConversations();
  }

  console.log("GRADE X DM interface connected.");
})();
/* ==========================================
   GRADE X — INSTAGRAM FOLLOW & STATS SYSTEM
========================================== */

async function loadProfileFollowStats(profileUserId, followerElId, followingElId) {
    const followerEl = document.getElementById(followerElId);
    const followingEl = document.getElementById(followingElId);

    if (!profileUserId) return;

    // Fetch Followers count
    const { count: followers } = await db
        .from("gx_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileUserId);

    // Fetch Following count
    const { count: following } = await db
        .from("gx_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileUserId);

    if (followerEl) followerEl.textContent = followers || 0;
    if (followingEl) followingEl.textContent = following || 0;
}

async function setupPublicStudentFollow(profileUserId) {
    const container = document.getElementById("publicStudentFollowContainer");
    const btn = document.getElementById("publicStudentFollowBtn");

    if (!container || !btn || !currentUser) {
        if (container) container.hidden = true;
        return;
    }

    // Hide follow button if viewing your own profile
    if (currentUser.id === profileUserId) {
        container.hidden = true;
        return;
    }

    container.hidden = false;

    // Check if current user already follows this student
    const { data: existing } = await db
        .from("gx_follows")
        .select("*")
        .eq("follower_id", currentUser.id)
        .eq("following_id", profileUserId)
        .maybeSingle();

    let isFollowing = !!existing;
    updateFollowBtnUI(btn, isFollowing);

    // Clean clone to prevent duplicate event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", async function () {
        newBtn.disabled = true;

        if (isFollowing) {
            // Unfollow action
            const { error } = await db
                .from("gx_follows")
                .delete()
                .eq("follower_id", currentUser.id)
                .eq("following_id", profileUserId);

            if (!error) {
                isFollowing = false;
                updateFollowBtnUI(newBtn, false);
                loadProfileFollowStats(profileUserId, "publicStudentFollowerCount", "publicStudentFollowingCount");
            }
        } else {
            // Follow action
            const { error } = await db
                .from("gx_follows")
                .insert({
                    follower_id: currentUser.id,
                    following_id: profileUserId
                });

            if (!error) {
                isFollowing = true;
                updateFollowBtnUI(newBtn, true);
                loadProfileFollowStats(profileUserId, "publicStudentFollowerCount", "publicStudentFollowingCount");
            }
        }
        newBtn.disabled = false;
    });
}

function updateFollowBtnUI(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = "Following";
        btn.classList.add("is-following");
    } else {
        btn.textContent = "Follow";
        btn.classList.remove("is-following");
    }
}
/* ==========================================
   GRADE X — INSTAGRAM FOLLOW & STATS SYSTEM
========================================== */

async function loadProfileFollowStats(profileUserId, followerElId, followingElId) {
    const followerEl = document.getElementById(followerElId);
    const followingEl = document.getElementById(followingElId);

    if (!profileUserId) return;

    const { count: followers, error: followerError } = await db
        .from("gx_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileUserId);

    const { count: following, error: followingError } = await db
        .from("gx_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileUserId);

    if (followerError) console.error("Error loading followers:", followerError);
    if (followingError) console.error("Error loading following:", followingError);

    if (followerEl) followerEl.textContent = followers || 0;
    if (followingEl) followingEl.textContent = following || 0;
}

async function setupPublicStudentFollow(profileUserId) {
    const btn = document.getElementById("publicStudentFollowBtn");
    if (!btn) return;

    // Force button to stay visible
    btn.style.display = "block";
    btn.disabled = false;

    // Hide if viewing your own profile
    if (currentUser && currentUser.id === profileUserId) {
        btn.style.display = "none";
        return;
    }

    let isFollowing = false;

    if (currentUser && currentUser.id) {
        const { data: existing } = await db
            .from("gx_follows")
            .select("*")
            .eq("follower_id", currentUser.id)
            .eq("following_id", profileUserId)
            .maybeSingle();

        isFollowing = !!existing;
    }

    updateFollowBtnUI(btn, isFollowing);

    // Clean clone to prevent duplicate event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", async function () {
        if (!currentUser || !currentUser.id) {
            alert("Please sign in to follow students.");
            return;
        }

        newBtn.disabled = true;

        if (isFollowing) {
            const { error } = await db
                .from("gx_follows")
                .delete()
                .eq("follower_id", currentUser.id)
                .eq("following_id", profileUserId);

            if (!error) {
                isFollowing = false;
                updateFollowBtnUI(newBtn, false);
                await loadProfileFollowStats(profileUserId, "publicStudentFollowerCount", "publicStudentFollowingCount");
            } else {
                alert("Unfollow failed: " + error.message);
            }
        } else {
            const { error } = await db
                .from("gx_follows")
                .insert({
                    follower_id: currentUser.id,
                    following_id: profileUserId
                });

            if (!error) {
                isFollowing = true;
                updateFollowBtnUI(newBtn, true);
                await loadProfileFollowStats(profileUserId, "publicStudentFollowerCount", "publicStudentFollowingCount");
            } else {
                alert("Follow failed: " + error.message);
            }
        }
        newBtn.disabled = false;
    });
}

function updateFollowBtnUI(btn, isFollowing) {
    if (isFollowing) {
        btn.textContent = "Following";
        btn.classList.add("is-following");
        btn.style.background = "#333";
    } else {
        btn.textContent = "Follow";
        btn.classList.remove("is-following");
        btn.style.background = "";
    }
}
{}