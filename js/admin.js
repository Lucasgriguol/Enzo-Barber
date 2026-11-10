import {
    db,
    collection,
    deleteDoc,
    updateDoc,
    doc,
    onSnapshot
} from "./firebase.js";

/* ===========================
   CONFIG
=========================== */

// ⚠️ IMPORTANTE: cambiá esta contraseña por una segura.
// Para cambiarla sin editar código, abrí la consola del navegador y ejecutá:
//   localStorage.setItem("adminPass", "tu_nueva_contraseña");
// Luego recargá la página.
const ADMIN_PASSWORD_DEFAULT = "000";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

function getAdminPassword() {
    return localStorage.getItem("adminPass") || ADMIN_PASSWORD_DEFAULT;
}

/* ===========================
   ELEMENTOS
=========================== */

const loginSection = document.getElementById("loginSection");
const panelSection = document.getElementById("panelSection");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const tableBody = document.getElementById("turnosTable");
const totalTurnos = document.getElementById("totalTurnos");
const turnosHoy = document.getElementById("turnosHoy");
const turnosPendientes = document.getElementById("turnosPendientes");
const ingresosTotal = document.getElementById("ingresosTotal");
const filterDate = document.getElementById("filterDate");
const searchName = document.getElementById("searchName");
const filterStatus = document.getElementById("filterStatus");
const emptyState = document.getElementById("emptyState");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const lastUpdate = document.getElementById("lastUpdate");
const toastContainer = document.getElementById("toastContainer");

const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");

/* ===========================
   TOAST
=========================== */

function showToast(message, type = "info", duration = 3000) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("toast-out");
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ===========================
   MODAL CONFIRMACIÓN
=========================== */

let confirmCallback = null;

function showConfirm({ title, message, onConfirm }) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.remove("hidden");
}

confirmCancel.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
    confirmCallback = null;
});

confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
        confirmModal.classList.add("hidden");
        confirmCallback = null;
    }
});

confirmOk.addEventListener("click", async () => {
    const cb = confirmCallback;
    confirmModal.classList.add("hidden");
    confirmCallback = null;
    if (cb) await cb();
});

/* ===========================
   LOGIN / SESIÓN
=========================== */

function sesionValida() {
    const logged = localStorage.getItem("adminLogged") === "true";
    const ts = parseInt(localStorage.getItem("adminLoggedAt") || "0", 10);
    if (!logged) return false;
    if (Date.now() - ts > SESSION_DURATION_MS) {
        localStorage.removeItem("adminLogged");
        localStorage.removeItem("adminLoggedAt");
        return false;
    }
    return true;
}

let unsubscribeTurnos = null;

function iniciarPanel() {
    loginSection.classList.add("hidden");
    panelSection.classList.remove("hidden");
    iniciarListenerTurnos();
}

function verificarSesion() {
    if (sesionValida()) iniciarPanel();
}

verificarSesion();

loginBtn.addEventListener("click", () => {
    const input = passwordInput.value.trim();
    if (input !== getAdminPassword()) {
        showToast("Contraseña incorrecta.", "error");
        passwordInput.value = "";
        passwordInput.focus();
        return;
    }
    localStorage.setItem("adminLogged", "true");
    localStorage.setItem("adminLoggedAt", String(Date.now()));
    passwordInput.value = "";
    iniciarPanel();
});

passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click();
});

logoutBtn.addEventListener("click", () => {
    showConfirm({
        title: "Cerrar sesión",
        message: "¿Seguro que querés cerrar sesión?",
        onConfirm: () => {
            if (unsubscribeTurnos) unsubscribeTurnos();
            localStorage.removeItem("adminLogged");
            localStorage.removeItem("adminLoggedAt");
            location.reload();
        }
    });
});

/* ===========================
   DATOS
=========================== */

let turnosGlobal = [];

/* ===========================
   LISTENER EN TIEMPO REAL
=========================== */

function iniciarListenerTurnos() {
    if (unsubscribeTurnos) unsubscribeTurnos();

    unsubscribeTurnos = onSnapshot(collection(db, "turnos"), (snapshot) => {
        turnosGlobal = [];
        snapshot.forEach(docSnap => {
            turnosGlobal.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Ordenar por fecha y hora ascendente
        turnosGlobal.sort((a, b) => {
            const fa = `${a.fecha} ${a.hora}`;
            const fb = `${b.fecha} ${b.hora}`;
            return fa.localeCompare(fb);
        });

        lastUpdate.textContent = new Date().toLocaleTimeString("es-AR");
        aplicarFiltros();
    }, (error) => {
        console.error("Error en listener:", error);
        showToast("Error al conectar con la base de datos.", "error");
    });
}

/* ===========================
   ESTADÍSTICAS
=========================== */

function actualizarStats(todos) {
    totalTurnos.textContent = todos.length;

    const hoy = new Date().toISOString().split("T")[0];
    turnosHoy.textContent = todos.filter(t => t.fecha === hoy).length;

    turnosPendientes.textContent = todos.filter(
        t => (t.estado || "pendiente") === "pendiente"
    ).length;

    const total = todos
        .filter(t => (t.estado || "pendiente") === "completado")
        .reduce((acc, t) => acc + (t.precio || 0), 0);

    ingresosTotal.textContent = total.toLocaleString("es-AR");
}

/* ===========================
   BADGE DE ESTADO
=========================== */

function estadoBadge(estado) {
    const e = estado || "pendiente";
    const labels = {
        pendiente: "Pendiente",
        completado: "Completado",
        cancelado: "Cancelado"
    };
    return `<span class="status-badge status-${e}">${labels[e] || e}</span>`;
}

/* ===========================
   TABLA
=========================== */

function renderTurnos(turnos) {
    tableBody.innerHTML = "";
    actualizarStats(turnosGlobal);

    if (turnos.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }
    emptyState.classList.add("hidden");

    const hoy = new Date().toISOString().split("T")[0];

    turnos.forEach(turno => {
        const tr = document.createElement("tr");
        const estado = turno.estado || "pendiente";
        const esHoy = turno.fecha === hoy;
        if (esHoy) tr.classList.add("row-hoy");
        if (estado === "cancelado") tr.classList.add("row-cancelado");

        const mensajeWA = encodeURIComponent(
            `Hola ${turno.nombre}, te recordamos tu turno en Enzo Barber el ${turno.fecha} a las ${turno.hora} hs para ${turno.servicio}. ¡Te esperamos!`
        );

        tr.innerHTML = `
            <td>${turno.nombre}</td>
            <td>${turno.telefono}</td>
            <td>${turno.servicio}</td>
            <td>$${(turno.precio || 0).toLocaleString("es-AR")}</td>
            <td>${turno.fecha}</td>
            <td>${turno.hora}</td>
            <td>${turno.observaciones || "-"}</td>
            <td>${estadoBadge(estado)}</td>
            <td class="actions-cell">
                <select class="status-select" data-id="${turno.id}">
                    <option value="pendiente" ${estado === "pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="completado" ${estado === "completado" ? "selected" : ""}>Completado</option>
                    <option value="cancelado" ${estado === "cancelado" ? "selected" : ""}>Cancelado</option>
                </select>
                <a href="https://wa.me/${turno.telefono.replace(/\D/g, "")}?text=${mensajeWA}"
                    target="_blank" rel="noopener"
                    class="wa-btn" title="Enviar WhatsApp">💬</a>
                <button class="delete-btn" data-id="${turno.id}" title="Eliminar">🗑</button>
            </td>
        `;

        tableBody.appendChild(tr);
    });

    // Eventos: cambio de estado
    document.querySelectorAll(".status-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const id = e.target.dataset.id;
            const nuevoEstado = e.target.value;
            try {
                await updateDoc(doc(db, "turnos", id), { estado: nuevoEstado });
                showToast(`Estado actualizado a ${nuevoEstado}.`, "success");
            } catch (error) {
                console.error(error);
                showToast("Error al actualizar estado.", "error");
            }
        });
    });

    // Eventos: eliminar
    document.querySelectorAll(".delete-btn[data-id]").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            showConfirm({
                title: "Eliminar turno",
                message: "¿Estás seguro de que querés eliminar este turno? Esta acción no se puede deshacer.",
                onConfirm: async () => {
                    try {
                        await deleteDoc(doc(db, "turnos", id));
                        showToast("Turno eliminado.", "success");
                    } catch (error) {
                        console.error(error);
                        showToast("Error al eliminar el turno.", "error");
                    }
                }
            });
        });
    });
}

/* ===========================
   FILTROS
=========================== */

filterDate.addEventListener("change", aplicarFiltros);
searchName.addEventListener("input", aplicarFiltros);
filterStatus.addEventListener("change", aplicarFiltros);

function aplicarFiltros() {
    const fecha = filterDate.value;
    const nombre = searchName.value.toLowerCase().trim();
    const estado = filterStatus.value;

    let resultado = [...turnosGlobal];

    if (fecha) {
        resultado = resultado.filter(t => t.fecha === fecha);
    }

    if (nombre) {
        resultado = resultado.filter(t =>
            (t.nombre || "").toLowerCase().includes(nombre) ||
            (t.telefono || "").includes(nombre) ||
            (t.servicio || "").toLowerCase().includes(nombre)
        );
    }

    if (estado) {
        resultado = resultado.filter(t => (t.estado || "pendiente") === estado);
    }

    renderTurnos(resultado);
}

/* ===========================
   REFRESCAR
=========================== */

refreshBtn.addEventListener("click", () => {
    lastUpdate.textContent = "Actualizando...";
    iniciarListenerTurnos();
    showToast("Datos actualizados.", "info");
});

/* ===========================
   EXPORTAR CSV
=========================== */

exportBtn.addEventListener("click", () => {
    if (turnosGlobal.length === 0) {
        showToast("No hay turnos para exportar.", "warning");
        return;
    }

    const headers = ["Cliente", "Teléfono", "Servicio", "Precio", "Fecha", "Hora", "Estado", "Observaciones"];
    const rows = turnosGlobal.map(t => [
        t.nombre || "",
        t.telefono || "",
        t.servicio || "",
        t.precio || 0,
        t.fecha || "",
        t.hora || "",
        t.estado || "pendiente",
        t.observaciones || ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turnos-enzo-barber-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("CSV descargado.", "success");
});

/* ===========================
   AUTO-REFRESH AL VOLVER A LA PESTAÑA
=========================== */

document.addEventListener("visibilitychange", () => {
    if (!document.hidden && panelSection.classList.contains("hidden") === false) {
        lastUpdate.textContent = "Actualizando...";
        // El listener de onSnapshot ya mantiene todo actualizado
        lastUpdate.textContent = new Date().toLocaleTimeString("es-AR");
    }
});