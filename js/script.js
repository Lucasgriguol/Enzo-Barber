import {
    db,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    onSnapshot
} from "./firebase.js";

/* ===========================
   ELEMENTOS
=========================== */

const bookingForm = document.getElementById("bookingForm");
const nombreInput = document.getElementById("nombre");
const telefonoInput = document.getElementById("telefono");
const observacionesInput = document.getElementById("observaciones");
const servicioSelect = document.getElementById("servicio");
const fechaInput = document.getElementById("fecha");
const horaSelect = document.getElementById("hora");
const loader = document.getElementById("loader");
const successMessage = document.getElementById("successMessage");
const whatsappLink = document.getElementById("whatsappLink");
const submitBtn = document.getElementById("submitBtn");
const pricePreview = document.getElementById("pricePreview");
const pricePreviewValue = document.getElementById("pricePreviewValue");
const horaHelper = document.getElementById("horaHelper");
const toastContainer = document.getElementById("toastContainer");

const confirmModal = document.getElementById("confirmModal");
const confirmDetails = document.getElementById("confirmDetails");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

/* ===========================
   CONFIG
=========================== */

const WHATSAPP = "543513484949";

const servicios = {
    "Clásico": { duracion: 45, precio: 12000 },
    "Barba": { duracion: 15, precio: 5000 },
    "Corte + Barba": { duracion: 60, precio: 15000 }
};

/* ===========================
   TOAST
=========================== */

function showToast(message, type = "info", duration = 3500) {
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
   MENÚ MÓVIL
=========================== */

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        mainNav.classList.toggle("open");
        menuToggle.classList.toggle("open");
    });

    mainNav.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            mainNav.classList.remove("open");
            menuToggle.classList.remove("open");
        });
    });
}

/* ===========================
   FECHA MÍNIMA (hoy)
=========================== */

const hoy = new Date();
const hoyISO = hoy.toISOString().split("T")[0];
fechaInput.min = hoyISO;

/* ===========================
   UTILIDADES
=========================== */

function formatearFecha(fecha) {
    const [año, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${año}`;
}

function formatearFechaLarga(fecha) {
    const [año, mes, dia] = fecha.split("-").map(Number);
    const d = new Date(año, mes - 1, dia);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${dias[d.getDay()]} ${dia} de ${meses[mes - 1]}`;
}

function horaAMinutos(hora) {
    const [h, m] = hora.split(":").map(Number);
    return (h * 60) + m;
}

function minutosAHora(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function obtenerBloquesOcupados(horaInicio, duracion) {
    const bloques = [];
    const inicio = horaAMinutos(horaInicio);
    const fin = inicio + duracion;
    let actual = inicio;
    while (actual < fin) {
        bloques.push(minutosAHora(actual));
        actual += 30;
    }
    return bloques;
}

function esFechaHoy(fecha) {
    return fecha === hoyISO;
}

function esHorarioPasado(hora) {
    if (!esFechaHoy(fechaInput.value)) return false;
    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return horaAMinutos(hora) <= minutosAhora;
}

/* ===========================
   HORARIOS BASE
=========================== */

function generarHorariosBase(fecha) {
    horaSelect.innerHTML = `<option value="">Seleccionar horario</option>`;
    horaHelper.textContent = "";

    if (!fecha) return;

    const [year, month, day] = fecha.split("-");
    const diaSemana = new Date(year, month - 1, day).getDay();

    if (diaSemana === 0) {
        showToast("La barbería permanece cerrada los domingos.", "warning");
        fechaInput.value = "";
        return;
    }

    const horarios = [];

    function agregarRango(inicio, fin) {
        let actual = horaAMinutos(inicio);
        const limite = horaAMinutos(fin);
        while (actual <= limite) {
            horarios.push(minutosAHora(actual));
            actual += 30;
        }
    }

    agregarRango("10:00", "13:00");
    if (diaSemana === 6) {
        agregarRango("17:00", "22:00");
    } else {
        agregarRango("17:00", "21:30");
    }

    horarios.forEach(hora => {
        const option = document.createElement("option");
        option.value = hora;
        option.textContent = hora;
        // Deshabilitar horarios pasados si es hoy
        if (esHorarioPasado(hora)) {
            option.disabled = true;
            option.textContent = `${hora} (pasó)`;
        }
        horaSelect.appendChild(option);
    });
}

/* ===========================
   DISPONIBILIDAD EN TIEMPO REAL
=========================== */

let unsubscribeDisponibilidad = null;

function escucharDisponibilidad(fecha) {
    if (unsubscribeDisponibilidad) {
        unsubscribeDisponibilidad();
        unsubscribeDisponibilidad = null;
    }

    if (!fecha) return;

    const q = query(collection(db, "turnos"), where("fecha", "==", fecha));

    unsubscribeDisponibilidad = onSnapshot(q, (snapshot) => {
        const bloquesOcupados = new Set();

        snapshot.forEach(docSnap => {
            const turno = docSnap.data();
            obtenerBloquesOcupados(turno.hora, turno.duracion || 30)
                .forEach(b => bloquesOcupados.add(b));
        });

        let disponibles = 0;
        [...horaSelect.options].forEach(option => {
            if (!option.value) return;

            // Preservar horarios pasados deshabilitados
            if (esHorarioPasado(option.value)) {
                option.disabled = true;
                option.textContent = `${option.value} (pasó)`;
                return;
            }

            const ocupado = bloquesOcupados.has(option.value);
            option.disabled = ocupado;
            option.textContent = ocupado
                ? `${option.value} (ocupado)`
                : option.value;

            if (!ocupado) disponibles++;
        });

        if (disponibles === 0) {
            horaHelper.textContent = "No quedan horarios disponibles para este día.";
        } else {
            horaHelper.textContent = `${disponibles} horario(s) disponible(s).`;
        }
    }, (error) => {
        console.error("Error al escuchar disponibilidad:", error);
    });
}

/* ===========================
   SERVICIO → PRECIO PREVIEW
=========================== */

function actualizarPreview() {
    const servicio = servicioSelect.value;
    if (!servicio || !servicios[servicio]) {
        pricePreview.classList.add("hidden");
        return;
    }
    const total = servicios[servicio].precio;
    pricePreviewValue.textContent = `$${total.toLocaleString("es-AR")}`;
    pricePreview.classList.remove("hidden");
}

servicioSelect.addEventListener("change", actualizarPreview);

/* ===========================
   TARJETAS DE SERVICIOS CLICKEABLES
=========================== */

document.querySelectorAll(".service-card").forEach(card => {
    card.addEventListener("click", (e) => {
        // No interferir con el botón
        if (e.target.classList.contains("btn-reservar-service")) return;

        const servicio = card.dataset.service;
        if (servicio) seleccionarServicio(servicio);
    });
});

document.querySelectorAll(".btn-reservar-service").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = btn.closest(".service-card");
        if (card) seleccionarServicio(card.dataset.service);
    });
});

function seleccionarServicio(servicio) {
    servicioSelect.value = servicio;
    actualizarPreview();
    document.getElementById("reservar").scrollIntoView({ behavior: "smooth" });
    showToast(`Servicio seleccionado: ${servicio}`, "success");
}

/* ===========================
   CAMBIO DE FECHA
=========================== */

fechaInput.addEventListener("change", () => {
    const fecha = fechaInput.value;

    if (fecha && fecha < hoyISO) {
        showToast("No podés reservar en fechas pasadas.", "error");
        fechaInput.value = "";
        return;
    }

    generarHorariosBase(fecha);
    escucharDisponibilidad(fecha);
});

/* ===========================
   VERIFICACIÓN FINAL
=========================== */

async function horarioDisponible(fecha, hora, duracion) {
    const q = query(collection(db, "turnos"), where("fecha", "==", fecha));
    const snapshot = await getDocs(q);

    const bloquesNuevo = obtenerBloquesOcupados(hora, duracion);
    let disponible = true;

    snapshot.forEach(docSnap => {
        const turno = docSnap.data();
        const bloquesExistentes = obtenerBloquesOcupados(
            turno.hora,
            turno.duracion || 30
        );
        const conflicto = bloquesNuevo.some(b => bloquesExistentes.includes(b));
        if (conflicto) disponible = false;
    });

    return disponible;
}

/* ===========================
   MODAL DE CONFIRMACIÓN
=========================== */

let pendingReserva = null;

function mostrarModalConfirmacion(datos) {
    pendingReserva = datos;

    confirmDetails.innerHTML = `
        <div class="confirm-row"><span>Cliente:</span> <strong>${datos.nombre}</strong></div>
        <div class="confirm-row"><span>Teléfono:</span> <strong>${datos.telefono}</strong></div>
        <div class="confirm-row"><span>Servicio:</span> <strong>${datos.servicio}</strong></div>
        <div class="confirm-row"><span>Fecha:</span> <strong>${formatearFechaLarga(datos.fecha)}</strong></div>
        <div class="confirm-row"><span>Hora:</span> <strong>${datos.hora} hs</strong></div>
        <div class="confirm-row"><span>Total:</span> <strong>$${datos.precio.toLocaleString("es-AR")}</strong></div>
        ${datos.observaciones ? `<div class="confirm-row"><span>Obs:</span> <em>${datos.observaciones}</em></div>` : ""}
    `;

    confirmModal.classList.remove("hidden");
}

function cerrarModal() {
    confirmModal.classList.add("hidden");
    pendingReserva = null;
}

confirmCancel.addEventListener("click", cerrarModal);
confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) cerrarModal();
});

confirmOk.addEventListener("click", async () => {
    if (!pendingReserva) return;
    const datos = pendingReserva;
    cerrarModal();
    await ejecutarReserva(datos);
});

/* ===========================
   RESERVAR
=========================== */

bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = nombreInput.value.trim();
    const telefono = telefonoInput.value.trim();
    const observaciones = observacionesInput.value.trim();
    const servicio = servicioSelect.value;
    const fecha = fechaInput.value;
    const hora = horaSelect.value;

    // Validaciones
    if (!nombre || !telefono || !servicio || !fecha || !hora) {
        showToast("Completá todos los campos obligatorios.", "error");
        return;
    }
    if (nombre.length < 2) {
        showToast("Ingresá tu nombre completo.", "error");
        return;
    }
    if (telefono.replace(/\D/g, "").length < 8) {
        showToast("Ingresá un teléfono válido.", "error");
        return;
    }
    if (fecha < hoyISO) {
        showToast("No podés reservar en el pasado.", "error");
        return;
    }
    if (esHorarioPasado(hora)) {
        showToast("Ese horario ya pasó. Elegí otro.", "error");
        return;
    }

    const duracion = servicios[servicio].duracion;
    const precio = servicios[servicio].precio;

    mostrarModalConfirmacion({
        nombre, telefono, observaciones, servicio, duracion, precio, fecha, hora
    });
});

async function ejecutarReserva(datos) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Reservando...";
    loader.classList.remove("hidden");

    try {
        const libre = await horarioDisponible(datos.fecha, datos.hora, datos.duracion);

        if (!libre) {
            showToast("Ese horario acaba de ocuparse. Elegí otro.", "error");
            return;
        }

        await addDoc(collection(db, "turnos"), {
            nombre: datos.nombre,
            telefono: datos.telefono,
            observaciones: datos.observaciones,
            servicio: datos.servicio,
            duracion: datos.duracion,
            precio: datos.precio,
            fecha: datos.fecha,
            hora: datos.hora,
            estado: "pendiente",
            timestamp: new Date().toISOString()
        });

        const fechaFormateada = formatearFechaLarga(datos.fecha);

        successMessage.innerHTML = `
            <h3>✅ Turno Confirmado</h3>
            <p><strong>Cliente:</strong> ${datos.nombre}</p>
            <p><strong>Servicio:</strong> ${datos.servicio}</p>
            <p><strong>Fecha:</strong> ${fechaFormateada}</p>
            <p><strong>Hora:</strong> ${datos.hora} hs</p>
            <a id="whatsappLink" class="btn-whatsapp" target="_blank" rel="noopener">
                Enviar por WhatsApp
            </a>
        `;

        const mensaje =
`Hola Enzo.

Reservé un turno.

Nombre: ${datos.nombre}
Teléfono: ${datos.telefono}
Servicio: ${datos.servicio}
Fecha: ${fechaFormateada}
Hora: ${datos.hora}

Observaciones:
${datos.observaciones || "Sin observaciones"}

¡Gracias!`;

        const nuevoWhatsapp = document.getElementById("whatsappLink");
        nuevoWhatsapp.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

        successMessage.classList.remove("hidden");

        bookingForm.reset();
        horaSelect.innerHTML = `<option value="">Seleccioná una fecha primero</option>`;
        horaHelper.textContent = "";
        pricePreview.classList.add("hidden");

        if (unsubscribeDisponibilidad) {
            unsubscribeDisponibilidad();
            unsubscribeDisponibilidad = null;
        }

        showToast("¡Turno confirmado con éxito!", "success");

        window.scrollTo({
            top: successMessage.offsetTop - 150,
            behavior: "smooth"
        });

    } catch (error) {
        console.error(error);
        showToast("Ocurrió un error al guardar la reserva.", "error");
    } finally {
        loader.classList.add("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Reservar Turno";
    }
}