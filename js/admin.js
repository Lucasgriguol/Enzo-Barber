import {
    db,
    collection,
    getDocs,
    deleteDoc,
    doc
} from "./firebase.js";

/* ===========================
   CONFIG
=========================== */

const ADMIN_PASSWORD = "000";

/* ===========================
   ELEMENTOS
=========================== */

const loginSection =
    document.getElementById(
        "loginSection"
    );

const panelSection =
    document.getElementById(
        "panelSection"
    );

const passwordInput =
    document.getElementById(
        "passwordInput"
    );

const loginBtn =
    document.getElementById(
        "loginBtn"
    );

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );

const tableBody =
    document.getElementById(
        "turnosTable"
    );

const totalTurnos =
    document.getElementById(
        "totalTurnos"
    );

const turnosHoy =
    document.getElementById(
        "turnosHoy"
    );

const ingresosTotal =
    document.getElementById(
        "ingresosTotal"
    );

const filterDate =
    document.getElementById(
        "filterDate"
    );

const searchName =
    document.getElementById(
        "searchName"
    );

const emptyState =
    document.getElementById(
        "emptyState"
    );

/* ===========================
   LOGIN
=========================== */

function verificarSesion() {

    const logged =
        localStorage.getItem(
            "adminLogged"
        );

    if (logged === "true") {

        loginSection.classList.add(
            "hidden"
        );

        panelSection.classList.remove(
            "hidden"
        );

        cargarTurnos();

    }

}

verificarSesion();

loginBtn.addEventListener(
    "click",
    () => {

        if (
            passwordInput.value.trim()
            !== ADMIN_PASSWORD
        ) {

            alert(
                "Contraseña incorrecta."
            );

            return;

        }

        localStorage.setItem(
            "adminLogged",
            "true"
        );

        loginSection.classList.add(
            "hidden"
        );

        panelSection.classList.remove(
            "hidden"
        );

        cargarTurnos();

    }
);

logoutBtn.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "adminLogged"
        );

        location.reload();

    }
);

/* ===========================
   DATOS
=========================== */

let turnosGlobal = [];

/* ===========================
   CARGA
=========================== */

async function cargarTurnos() {

    turnosGlobal = [];

    const snapshot =
        await getDocs(
            collection(
                db,
                "turnos"
            )
        );

    snapshot.forEach(docSnap => {

        turnosGlobal.push({

            id: docSnap.id,
            ...docSnap.data()

        });

    });

    turnosGlobal.sort(
        (a, b) => {

            const fa =
                `${a.fecha} ${a.hora}`;

            const fb =
                `${b.fecha} ${b.hora}`;

            return fa.localeCompare(fb);

        }
    );

    renderTurnos(
        turnosGlobal
    );

}

/* ===========================
   ESTADISTICAS
=========================== */

function actualizarStats(
    turnos
) {

    totalTurnos.textContent =
        turnos.length;

    const hoy =
        new Date()
            .toISOString()
            .split("T")[0];

    const hoyCount =
        turnos.filter(
            t => t.fecha === hoy
        ).length;

    turnosHoy.textContent =
        hoyCount;

    const total =
        turnos.reduce(
            (acc, t) =>
                acc + (t.precio || 0),
            0
        );

    ingresosTotal.textContent =
        total.toLocaleString(
            "es-AR"
        );

}

/* ===========================
   TABLA
=========================== */

function renderTurnos(
    turnos
) {

    tableBody.innerHTML = "";

    actualizarStats(
        turnos
    );

    if (
        turnos.length === 0
    ) {

        emptyState.classList.remove(
            "hidden"
        );

        return;

    }

    emptyState.classList.add(
        "hidden"
    );

    turnos.forEach(turno => {

        const tr =
            document.createElement(
                "tr"
            );

        tr.innerHTML = `

            <td>
                ${turno.nombre}
            </td>

            <td>
                ${turno.telefono}
            </td>

            <td>
                ${turno.servicio}
            </td>

            <td>
                $${(turno.precio || 0)
                    .toLocaleString("es-AR")}
            </td>

            <td>
                ${turno.fecha}
            </td>

            <td>
                ${turno.hora}
            </td>

            <td>
                ${
                    turno.observaciones
                    || "-"
                }
            </td>

            <td>

                <button
                    class="delete-btn"
                    data-id="${turno.id}"
                >
                    Eliminar
                </button>

            </td>

        `;

        tableBody.appendChild(
            tr
        );

    });

    document
        .querySelectorAll(
            ".delete-btn[data-id]"
        )
        .forEach(btn => {

            btn.addEventListener(
                "click",
                async () => {

                    const ok =
                        confirm(
                            "¿Eliminar turno?"
                        );

                    if (!ok)
                        return;

                    await deleteDoc(
                        doc(
                            db,
                            "turnos",
                            btn.dataset.id
                        )
                    );

                    cargarTurnos();

                }
            );

        });

}

/* ===========================
   FILTROS
=========================== */

filterDate.addEventListener(
    "change",
    aplicarFiltros
);

searchName.addEventListener(
    "input",
    aplicarFiltros
);

function aplicarFiltros() {

    const fecha =
        filterDate.value;

    const nombre =
        searchName.value
        .toLowerCase()
        .trim();

    let resultado =
        [...turnosGlobal];

    if (fecha) {

        resultado =
            resultado.filter(
                turno =>
                    turno.fecha === fecha
            );

    }

    if (nombre) {

        resultado =
            resultado.filter(
                turno =>
                    turno.nombre
                    .toLowerCase()
                    .includes(nombre)
            );

    }

    renderTurnos(
        resultado
    );

}