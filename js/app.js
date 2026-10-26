import { db } from "./firebase-config.js";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Contenedores
const contenedorPedidos = document.getElementById("contenedor-pedidos");
const contadorPendientes = document.getElementById("contador-pendientes");
const contadorEntregados = document.getElementById("contador-entregados");
// Botones de filtro
const btnPendientes = document.getElementById("btn-filtro-pendientes");
const btnEntregados = document.getElementById("btn-filtro-entregados");

// Estado de la Aplicación
let filtroActual = "pendiente";
let listaPedidosGlobal = [];
let esCargaInicial = true;

// LOGICA DE INTERFAZ ==============================================
// Conexion en tiempo real con firebase
function sincronizarPedidos() {
    if (!contenedorPedidos) return;

    const refPedidos = collection(db, "pedidos");

    onSnapshot(refPedidos, (snapshot) => {
        // Notificación para nuevos pedidos
        if (!esCargaInicial) {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const nuevoPedido = change.doc.data();
                    lanzarNotificacion(
                        "¡Nuevo pedido recibido!",
                        `Cliente: ${nuevoPedido.cliente || "Anónimo"} - Total: ₡${(nuevoPedido.total || 0).toLocaleString("es-CR")}`
                    );
                }
            });
        }

        esCargaInicial = false;

        // Guardamos los datos recibidos en nuestro arreglo global
        listaPedidosGlobal = [];
        snapshot.forEach((docSnap) => {
            listaPedidosGlobal.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Renderizamos según el filtro activo
        renderizarPedidos();
    }, (error) => {
        console.error("Error al escuchar pedidos:", error);
        contenedorPedidos.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle fs-1"></i>
                <p class="mt-2">Error al cargar los pedidos en tiempo real.</p>
            </div>`;
    });
}
// Renderiza la lista de pedidos pendientes y entregados
function renderizarPedidos() {
    if (!contenedorPedidos) return;

    contadorEntregados.textContent = listaPedidosGlobal.filter(p => {
        const estado = p.estado ? p.estado : "entregado";
        return estado === "entregado";
    }).length;
    contadorPendientes.textContent = listaPedidosGlobal.filter(p => {
        const estado = p.estado ? p.estado : "pendiente";
        return estado === "pendiente";
    }).length;

    contenedorPedidos.innerHTML = "";

    // Filtrar lista segun el estado seleccionado
    const pedidosFiltrados = listaPedidosGlobal.filter(p => {
        const estadoPedido = p.estado ? p.estado : "pendiente";
        return estadoPedido === filtroActual;
    });

    // Ordenar por fecha de más reciente a más antiguo
    pedidosFiltrados.sort((a, b) => {
        const fechaA = a.fecha ? (a.fecha.seconds || 0) : 0;
        const fechaB = b.fecha ? (b.fecha.seconds || 0) : 0;
        return fechaB - fechaA;
    });

    // Si no hay pedidos en la categoría actual
    if (pedidosFiltrados.length === 0) {
        const mensajeVacio = filtroActual === "pendiente"
            ? "No hay pedidos pendientes en este momento."
            : "No hay pedidos entregados en este momento.";

        contenedorPedidos.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-inbox fs-1"></i>
                <p class="mt-2">${mensajeVacio}</p>
            </div>`;
        return;
    }

    // Dibujar cada tarjeta
    pedidosFiltrados.forEach((pedido) => {
        const id = pedido.id;
        const idCorto = id.slice(0, 10);
        const esEntregado = pedido.estado === "entregado";

        let htmlProductos = "";
        if (pedido.productos && Array.isArray(pedido.productos)) {
            pedido.productos.forEach((p) => {
                const cantidad = p.cantidad || 1;
                const precio = p.precio || 0;
                const subtotal = p.subtotal || (cantidad * precio);

                htmlProductos += `
                    <div class="d-flex justify-content-between small py-1">
                        <span>${p.nombre || "Producto"} <small class="text-muted">${cantidad} x ₡${precio.toLocaleString("es-CR")}</small></span>
                        <span class="fw-semibold">₡${subtotal.toLocaleString("es-CR")}</span>
                    </div>
                `;
            });
        }

        const fechaMostrar = pedido.fechaStr || "Fecha no especificada";

        const tarjeta = document.createElement("div");
        tarjeta.className = `card card-body border-0 shadow-sm mb-3 rounded-4 p-3 ${esEntregado ? 'bg-light opacity-75' : ''}`;
        tarjeta.innerHTML = `
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <span class="badge bg-dark mb-2 fs-6">
                        Pedido #${idCorto}
                    </span>
                    <div class="text-muted small">
                        <i class="bi bi-calendar-event me-1"></i>
                        ${fechaMostrar}
                    </div>
                </div>
            </div>

            <div class="card bg-body-tertiary border-0 mb-3">
                <div class="card-body py-2">
                    <div class="mb-2">
                        <small class="text-muted d-block">
                            <i class="bi bi-person-fill me-1"></i>Cliente: ${pedido.cliente}
                        </small>
                    </div>
                    <div>
                        <small class="text-muted d-block">
                            <i class="bi bi-geo-alt-fill me-1"></i>Dirección: ${pedido.direccion}
                        </small>
                    </div>
                </div>
            </div>

            <div class="mb-3">
                <h6 class="fw-bold mb-2">
                    <i class="bi bi-bag-fill me-2"></i>
                    Productos
                </h6>
                ${htmlProductos}
            </div>

            <div class="alert alert-success d-flex justify-content-between align-items-center mb-3">
                <span class="fw-bold">
                    Total
                </span>
                <span class="fs-4 fw-bold">
                    ₡${(pedido.total || 0).toLocaleString("es-CR")}
                </span>
            </div>

            ${!esEntregado ? `
                <button
                    class="btn btn-success w-100 py-3 fw-semibold btn-entregado"
                    data-id="${id}"
                    data-cliente="${pedido.cliente || 'Cliente'}">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    Marcar como entregado
                </button>
            ` : `
                <button
                    class="btn btn-outline-success w-100 py-3 fw-semibold"
                    disabled>
                    <i class="bi bi-check-all me-2"></i>
                    Pedido entregado
                </button>
            `}
        `;

        contenedorPedidos.appendChild(tarjeta);
    });

    // Eventos a los botones de entregado
    document.querySelectorAll(".btn-entregado").forEach((boton) => {
        boton.addEventListener("click", (e) => {
            const idPedido = e.currentTarget.dataset.id;
            const cliente = e.currentTarget.dataset.cliente;
            updateEstadoEntregado(idPedido, cliente);
        });
    });
}

// Actualiza el estado de un pedido a "entregado" en Firestore
async function updateEstadoEntregado(idPedido, nombreCliente) {
    try {
        const pedidoRef = doc(db, "pedidos", idPedido);
        await updateDoc(pedidoRef, {
            estado: "entregado"
        });
        const modalEntregado = document.getElementById("modalEntregado");
        const modalEntregadoInstance = new bootstrap.Modal(modalEntregado);

        const modalMensajeEntregado = document.getElementById("modal-mensaje-entregado");
        if (modalMensajeEntregado) {
            const idCorto = idPedido.slice(-5).toUpperCase();
            modalMensajeEntregado.textContent = `El pedido #${idCorto} de ${nombreCliente} ha sido marcado como entregado.`;
        }

        modalEntregadoInstance.show();

        lanzarNotificacion("¡Pedido Entregado!", `El pedido de ${nombreCliente} cambió a estado entregado.`);
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        alert("Ocurrió un error al actualizar el pedido.");
    }
}

// ESCUCHADORES DE EVENTOS PARA BOTONES ============================
if (btnPendientes && btnEntregados) {
    btnPendientes.addEventListener("click", () => {
        filtroActual = "pendiente";
        btnPendientes.className = "btn btn-warning active fw-semibold py-2";
        btnEntregados.className = "btn btn-outline-success fw-semibold py-2";

        renderizarPedidos();
    });

    btnEntregados.addEventListener("click", () => {
        filtroActual = "entregado";
        btnPendientes.className = "btn btn-outline-warning fw-semibold py-2";
        btnEntregados.className = "btn btn-success active fw-semibold py-2";
        renderizarPedidos();
    });
}

// NOTIFICACIONES Y PERMISOS =======================================
function solicitarPermisoNotificaciones() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

async function lanzarNotificacion(titulo, cuerpo) {
    if ("Notification" in window && Notification.permission === "granted") {
        const opciones = {
            body: cuerpo,
            icon: "/icons/icon512_rounded.png",
            badge: "/icons/icon_badge.jpg"
        };
        // Comprobar si el Service Worker está activo y usarlo para disparar la alerta
        if ("serviceWorker" in navigator) {
            const registroSW = await navigator.serviceWorker.ready;
            registroSW.showNotification(titulo, opciones);
        } else {
            new Notification(titulo, opciones);
        }
    }
}

// Registrar el Service Worker para habilitar la PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registrado con éxito en el alcance:', registration.scope);
            })
            .catch((error) => {
                console.error('Error al registrar el Service Worker:', error);
            });
    });
}

// Inicialización de la App
sincronizarPedidos();
solicitarPermisoNotificaciones();

