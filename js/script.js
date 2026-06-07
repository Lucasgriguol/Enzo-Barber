import {
    db,
    collection,
    addDoc,
    getDocs
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

const submitBtn = bookingForm.querySelector(
    'button[type="submit"]'
);

/* ===========================
   CONFIG
=========================== */

const WHATSAPP = "543513484949";

const servicios = {

    "Clásico": {
        duracion: 45,
        precio: 12000
    },

    "Barba": {
        duracion: 15,
        precio: 5000
    },

    "Corte + Barba": {
        duracion: 60,
        precio: 15000
    }

};

/* ===========================
   FECHA MÍNIMA
=========================== */

const hoy = new Date();

fechaInput.min =
    hoy.toISOString().split("T")[0];

/* ===========================
   UTILIDADES
=========================== */

function formatearFecha(fecha) {

    const [año, mes, dia] =
        fecha.split("-");

    return `${dia}/${mes}/${año}`;

}

function horaAMinutos(hora) {

    const [h, m] =
        hora.split(":").map(Number);

    return (h * 60) + m;

}

function minutosAHora(minutos) {

    const h =
        Math.floor(minutos / 60);

    const m =
        minutos % 60;

    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;

}

function obtenerBloquesOcupados(
    horaInicio,
    duracion
) {

    const bloques = [];

    const inicio =
        horaAMinutos(horaInicio);

    const fin =
        inicio + duracion;

    let actual = inicio;

    while (actual < fin) {

        bloques.push(
            minutosAHora(actual)
        );

        actual += 30;

    }

    return bloques;

}

/* ===========================
   HORARIOS DISPONIBLES
=========================== */

function generarHorariosBase(fecha) {

    horaSelect.innerHTML =
        `<option value="">Seleccionar horario</option>`;

    if (!fecha) return;

    const [year, month, day] =
        fecha.split("-");

    const diaSemana =
        new Date(
            year,
            month - 1,
            day
        ).getDay();

    // domingo

    if (diaSemana === 0) {

        alert(
            "La barbería permanece cerrada los domingos."
        );

        fechaInput.value = "";

        return;
    }

    const horarios = [];

    function agregarRango(
        inicio,
        fin
    ) {

        let actual =
            horaAMinutos(inicio);

        const limite =
            horaAMinutos(fin);

        while (actual <= limite) {

            horarios.push(
                minutosAHora(actual)
            );

            actual += 30;
        }
    }

    agregarRango(
        "10:00",
        "13:00"
    );

    if (diaSemana === 6) {

        agregarRango(
            "17:00",
            "22:00"
        );

    } else {

        agregarRango(
            "17:00",
            "21:30"
        );

    }

    horarios.forEach(hora => {

        const option =
            document.createElement("option");

        option.value = hora;
        option.textContent = hora;

        horaSelect.appendChild(option);

    });

}

/* ===========================
   DISPONIBILIDAD
=========================== */

async function actualizarDisponibilidad() {

    const fecha =
        fechaInput.value;

    if (!fecha) return;

    const snapshot =
        await getDocs(
            collection(
                db,
                "turnos"
            )
        );

    const bloquesOcupados =
        new Set();

    snapshot.forEach(doc => {

        const turno =
            doc.data();

        if (
            turno.fecha !== fecha
        ) return;

        const bloques =
            obtenerBloquesOcupados(
                turno.hora,
                turno.duracion
            );

        bloques.forEach(b =>
            bloquesOcupados.add(b)
        );

    });

    [...horaSelect.options]
    .forEach(option => {

        if (
            !option.value
        ) return;

        option.disabled =
            bloquesOcupados.has(
                option.value
            );

        option.textContent =
            option.disabled
                ? `${option.value} (ocupado)`
                : option.value;

    });

}

/* ===========================
   CAMBIO DE FECHA
=========================== */

fechaInput.addEventListener(
    "change",
    async () => {

        generarHorariosBase(
            fechaInput.value
        );

        await actualizarDisponibilidad();

    }
);

/* ===========================
   VERIFICACIÓN FINAL
=========================== */

async function horarioDisponible(
    fecha,
    hora,
    duracion
) {

    const snapshot =
        await getDocs(
            collection(
                db,
                "turnos"
            )
        );

    const bloquesNuevo =
        obtenerBloquesOcupados(
            hora,
            duracion
        );

    let disponible = true;

    snapshot.forEach(doc => {

        const turno =
            doc.data();

        if (
            turno.fecha !== fecha
        ) return;

        const bloquesExistentes =
            obtenerBloquesOcupados(
                turno.hora,
                turno.duracion
            );

        const conflicto =
            bloquesNuevo.some(
                bloque =>
                    bloquesExistentes.includes(
                        bloque
                    )
            );

        if (conflicto) {

            disponible = false;

        }

    });

    return disponible;

}

/* ===========================
   RESERVAR
=========================== */

bookingForm.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        const nombre =
            nombreInput.value.trim();

        const telefono =
            telefonoInput.value.trim();

        const observaciones =
            observacionesInput?.value.trim() || "";

        const servicio =
            servicioSelect.value;

        const fecha =
            fechaInput.value;

        const hora =
            horaSelect.value;

        if (
            !nombre ||
            !telefono ||
            !servicio ||
            !fecha ||
            !hora
        ) {

            alert(
                "Completá todos los campos obligatorios."
            );

            return;

        }

        const duracion =
            servicios[servicio].duracion;

        const precio =
            servicios[servicio].precio;

        submitBtn.disabled = true;

        submitBtn.textContent =
            "Reservando...";

        loader.classList.remove(
            "hidden"
        );

        try {

            const libre =
                await horarioDisponible(
                    fecha,
                    hora,
                    duracion
                );

            if (!libre) {

                loader.classList.add(
                    "hidden"
                );

                submitBtn.disabled =
                    false;

                submitBtn.textContent =
                    "Reservar Turno";

                alert(
                    "Ese horario acaba de ocuparse. Elegí otro."
                );

                await actualizarDisponibilidad();

                return;

            }

            await addDoc(
                collection(
                    db,
                    "turnos"
                ),
                {
                    nombre,
                    telefono,
                    observaciones,
                    servicio,
                    duracion,
                    precio,
                    fecha,
                    hora,
                    timestamp:
                        new Date().toISOString()
                }
            );

            const fechaFormateada =
                formatearFecha(
                    fecha
                );

            successMessage.innerHTML = `
                <h3>
                    ✅ Turno Confirmado
                </h3>

                <p>
                    <strong>Cliente:</strong>
                    ${nombre}
                </p>

                <p>
                    <strong>Servicio:</strong>
                    ${servicio}
                </p>

                <p>
                    <strong>Fecha:</strong>
                    ${fechaFormateada}
                </p>

                <p>
                    <strong>Hora:</strong>
                    ${hora}
                </p>

                <a
                    id="whatsappLink"
                    class="btn-whatsapp"
                    target="_blank"
                >
                    Enviar por WhatsApp
                </a>
            `;

            const mensaje =

`Hola Enzo.

Reservé un turno.

Nombre: ${nombre}
Teléfono: ${telefono}
Servicio: ${servicio}
Fecha: ${fechaFormateada}
Hora: ${hora}

Observaciones:
${observaciones || "Sin observaciones"}

Gracias.`;

            const nuevoWhatsapp =
                document.getElementById(
                    "whatsappLink"
                );

            nuevoWhatsapp.href =
                `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;

            successMessage.classList.remove(
                "hidden"
            );

            bookingForm.reset();

            horaSelect.innerHTML =
                `<option value="">Seleccionar horario</option>`;

            window.scrollTo({
                top:
                    successMessage.offsetTop - 150,
                behavior:"smooth"
            });

        } catch (error) {

            console.error(error);

            alert(
                "Ocurrió un error al guardar la reserva."
            );

        } finally {

            loader.classList.add(
                "hidden"
            );

            submitBtn.disabled =
                false;

            submitBtn.textContent =
                "Reservar Turno";

        }

    }
);