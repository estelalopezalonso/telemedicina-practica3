// Estado global (cliente)
var seccionActual = "login";
var gestorActualId = null;
var tokenGestor = null;
var ws = null;

var cacheCategorias = [];
var cacheModelos = [];
var cacheUbicaciones = [];
var cacheSanitarios = {};

function cambiarSeccion(seccion) {
  document.getElementById(seccionActual).classList.remove("activa");
  document.getElementById(seccion).classList.add("activa");
  seccionActual = seccion;
}

// Login / Registro / Salir
function entrar() {
  var u = document.getElementById("usuarioLogin").value;
  var p = document.getElementById("passwordLogin").value;

  document.getElementById("msgLogin").innerHTML = ""; //limpia mensajes anteriores

  rest.post("/api/gestores/login", {
    login: u,
    password: p
  }, function (status, respuesta) {
  if (status !== 200 || !respuesta ||
      respuesta.id == null || !respuesta.token) {
    document.getElementById("msgLogin").innerHTML =
      "Credenciales incorrectas.";
    return;
  }

  gestorActualId = respuesta.id;
  tokenGestor = respuesta.token;
    conectarWSGestor();

    cargarDatosIniciales(function () {
      cargarBienvenida();
      prepararFiltros();
      limpiarTablaRecursos();
      cambiarSeccion("menu-principal");
    });
  });
}

function irRegistro() {
  document.getElementById("tituloRegistro").innerHTML = "Registrar gestor";
  document.getElementById("msgRegistro").innerHTML = "";

  document.getElementById("gNombre").value = "";
  document.getElementById("gApellidos").value = "";
  document.getElementById("gUsuario").value = "";
  document.getElementById("gPassword").value = "";

  cambiarSeccion("registro");
}

function volverLogin() {
  cambiarSeccion("login");
}

function guardarGestor() {
  var payload = {
    nombre: document.getElementById("gNombre").value,
    apellidos: document.getElementById("gApellidos").value,
    usuario: document.getElementById("gUsuario").value,
    password: document.getElementById("gPassword").value
  };

  document.getElementById("msgRegistro").innerHTML = "";
  //registrando (hara un post)-> si vale null crea un gestor nuevo con los datos guardados en el objeto creado "payload"
  if (gestorActualId == null) {
    rest.post("/api/gestores", payload, function (status, idNuevo) {
      if (status !== 201 || idNuevo == null) {
        document.getElementById("msgRegistro").innerHTML =
          "No se pudo registrar (usuario ya existe).";
        return;
      }

      document.getElementById("msgRegistro").innerHTML =
        "Registrado correctamente. Ya puedes hacer login.";
    });
  //modificando(hara un put)
  } else {
    rest.put("/api/gestores/" + gestorActualId, payload, function (status) {
      if (status !== 200) {
        document.getElementById("msgRegistro").innerHTML =
          "No se pudo actualizar (usuario ya existe).";
        return;
      }

      document.getElementById("msgRegistro").innerHTML =
        "Datos actualizados.";

      cargarBienvenida();
    });
  }
}

function editarMisDatos() {
  document.getElementById("tituloRegistro").innerHTML =
    //cambia el titulo y pone:
    "Editar datos del gestor"; 

  //limpia mensajes anteriores:
  document.getElementById("msgRegistro").innerHTML = "";

  rest.get("/api/gestores/" + gestorActualId, function respuestaGestor(status, datosGestor) {
    if (status !== 200 || !datosGestor) {
      return; //si falla o no recibe nada la funcion termina
    }

    document.getElementById("gNombre").value = datosGestor.nombre || "";
    document.getElementById("gApellidos").value = datosGestor.apellidos || "";
    document.getElementById("gUsuario").value = datosGestor.usuario || "";
    document.getElementById("gPassword").value = ""; //la contraseña no se envia paar mayor seguridad

    cambiarSeccion("registro");
  });
}

function salir() {
  cerrarWS();
  gestorActualId = null;
  tokenGestor = null;

  document.getElementById("usuarioLogin").value = "";
  document.getElementById("passwordLogin").value = "";
  document.getElementById("msgLogin").innerHTML = "";

  cambiarSeccion("login");
}

// Carga inicial
function cargarDatosIniciales(callback) {
  rest.get("/api/categorias", function respuestaCategorias(status, cats) {
    if (status === 200) {
      cacheCategorias = cats;
    } else {
      cacheCategorias = [];
    }

    rest.get("/api/modelos", function respuestaModelos(status, mods) {
      if (status === 200) {
        cacheModelos = mods;
      } else {
        cacheModelos = [];
      }

      rest.get("/api/ubicaciones", function respuestaUbicaciones(status, ubis) {
        if (status === 200) {
          cacheUbicaciones = ubis;
        } else {
          cacheUbicaciones = [];
        }

        callback();
      });
    });
  });
}

function cargarBienvenida() {
  rest.get("/api/gestores/" + gestorActualId, function (status, datosGestor) {
    //datosGestor-> Datos que el servidor ha enviado sin contraseña
    if (status !== 200 || !datosGestor) {
      return;
    }

    document.getElementById("bienvenida").innerHTML =
      "Bienvenido/a, <b>" + datosGestor.nombre + " " + datosGestor.apellidos + "</b>";
  });
}

// Filtros y listado
function prepararFiltros() {
  var selCat = document.getElementById("fCategoria"); //selCat ahora representa el desplegable de categorias

  selCat.innerHTML = "";//vacio el desplegable (esto evita que se duplique si lo ejecutas varias veces)
  selCat.appendChild(opcion("-1", "Todos"));//añade la opcion de todos en el desplegable con valor -1

  cacheCategorias.forEach(function (categoriaDelArray) { 
  //forEach->recorre todos elemos del array uno por uno, por cada vuelta se añadira una categoria (se hara 3 veces:1º solo termomentro,2º se añade esteto,3ºse añade silla) aunq al final quedaran 4 opciones pq hemos creado antes la opcion de todos
    var idCategoriaTexto = //al recorrer el foreach sacamos el id y lo pasamos a String
      String(categoriaDelArray.id);

    var nombreCategoria = //ahora saca el nombre
      categoriaDelArray.nombre;

    var nuevaOpcion = //crea un elemento <option> con todo 
      opcion(idCategoriaTexto, nombreCategoria);

    selCat.appendChild(nuevaOpcion);//y la añade al desplegable

  //se repite este proceso 3 veces hasta añadir los 3 elementos que hay el en el array de categorias
  });

  var selUbi = document.getElementById("fUbicacion");//igual q categorias

  selUbi.innerHTML = "";
  selUbi.appendChild(opcion("-1", "Todos"));

  cacheUbicaciones.forEach(function (ubicacionArray) { //en este caso como hay 4 ubicaciones se ejecuta 4. En total habra 5 opciones ya que añade antes la de todos
    var idUbicacionTexto =
      String(ubicacionArray.id);

    var nombreUbicacion =
      ubicacionArray.nombre;

    var nuevaOpcion =
      opcion(idUbicacionTexto, nombreUbicacion);

  selUbi.appendChild(nuevaOpcion);
  });

  actualizarSelectModelos();//cuando termina categorias y ubicaciones se ejecuta y llama a Modelos
}
//esta funcion se llama en el caso anterior tras ser llamada tras montar las categorias e ubicaciones
function actualizarSelectModelos() {
  var catId = parseInt(
    document.getElementById("fCategoria").value,10 //busca el desplegable y obtiene el valor de la opcion seleccionada
    //y lo convierte en un numero y lo guarda en la variable catId
  );

  var selMod = document.getElementById("fModelo"); //desplegable donde se mostrara los modelo

  selMod.innerHTML = "";
  selMod.appendChild(opcion("-1", "Todos"));

  cacheModelos.forEach(function (modeloArray) {//recorre todos los modelos uno a uno
    //AQUI YA NO ES COMO ANTES, solo muestra los que son de la misma categoria 
    if (catId === -1 || modeloArray.categoria === catId) {
      //muestra todos (valor -1) o si pertenece a la categoria seleccionada
     // Obtiene el id del modelo y lo convierte a texto
      var idModeloTexto =
        String(modeloArray.id);

      // Obtiene el nombre del modelo
      var nombreModelo =
        modeloArray.nombre;

      // Crea un elemento <option>
      var nuevaOpcion =
        opcion(idModeloTexto, nombreModelo);

      // Añade la opción al desplegable de modelos
      selMod.appendChild(nuevaOpcion);
    }
  });
}

function buscarRecursos() {
  //recoge los valores de las opciones seleccionadas
  var categoria = document.getElementById("fCategoria").value;
  var modelo = document.getElementById("fModelo").value;
  var ubicacion = document.getElementById("fUbicacion").value;
  var estado = document.getElementById("fEstado").value;

  //? significa q vamos a enviar filtros o parametros
  var url = "/api/recursos?";
  
  //vamos añadiendo los filtros a la url (si es diferente de -1 (que es el valor de todos))
  if (categoria !== "-1") {
    url += "categoria=" + categoria + "&";
  }

  if (modelo !== "-1") {
    url += "modelo=" + modelo + "&";
  }

  if (ubicacion !== "-1") {
    url += "ubicacion=" + ubicacion + "&";
  }

  if (estado !== "-1") {
    url += "estado=" + estado + "&";
  }

  rest.get(url, function (status, recursos) {//envia la peticion get a la url creada 
    if (status !== 200) {
      recursos = [];//si el status no sale 200 sustituye el array del recurso encontrado por un array vacio
    }

    pintarTablaRecursos(recursos); //llama a otra funcion(*) y le pasa el array final(ya sea el encontrado o el vacio)
  });
}

function limpiarTablaRecursos() {
  document.getElementById("tablaRecursosBody").innerHTML = "";
}//Vacía el cuerpo de la tabla y elimina los recursos mostrados anteriormente

function pintarTablaRecursos(recursos) { //recibe el array final (recursos encontrados) viene de la funcion anterior(*)
  var tbody = document.getElementById("tablaRecursosBody"); //guarda el cuerpo de la tabla en una variable, para usarla y no estar escribiendo todo esto cada vez

  tbody.innerHTML = "";//vacia la tabla para quitar los resultados de busquedas anteriores

  recursos.forEach(function (r) {//recorre el array d recursos donde r es el recurso actual
    var tr = document.createElement("tr"); //tr-> crea nueva fila para ese recurso

    //el recurso guarda el valor(id), pero en la tabla querems mostrar el texto(nombre)
    var modelo = cacheModelos.find(function (m) {//busca el modelo cuyo id sea igual al de modelo almcenado y lo devuelve
      return m.id === r.modelo;
    });

    //tras encontrar el modelo buscamos su categoria (ATENCION dentro del recurso no tenemos categoria por eso aprovechamos q tenemos el modelo de antes)
    //la categoria esta indicada dentro del modelo encontrado
    var categoria = null;//creamos la var categoria y la inicializamos a null q indica q aun no hmos encontrado na

    if (modelo) { //si anteriormente se ha encontrado el modelo, busca ahora su categoría
      categoria = cacheCategorias.find(function (c) {
        //find() recorre esas categorías una por una. La variable c representa una categoría diferente en cada vuelta,si coincide con el id de la categoria guardado en el modelo, la devuleve
        return c.id === modelo.categoria;
      });
    }
    
    //igual q modelo
    var ubicacion = cacheUbicaciones.find(function (u) {
      return u.id === r.ubicacion;
      //el recurso guarda el id de la ubicacion y busca q coincida con el id guardado en el recurso
    });

    //ya tenemos los 3 objetos (modelo,categoria e ubicacion) ahora sacamos los nombres 
    var nombreCategoria = ""; //inicializa el nombre como texto vacio
    if (categoria) { // Si se encontra la categoria guarda su nombre
      nombreCategoria = categoria.nombre;
    }

    var nombreModelo = "";
    if (modelo) {
      nombreModelo = modelo.nombre;
    }

    var nombreUbicacion = "";
    if (ubicacion) {
      nombreUbicacion = ubicacion.nombre;
    }
    //añadimo a la tabla la siguiente fila (td, esta definada mas adelante lo que hace es crear una celda introduce el texto y la devuelve)
    tr.appendChild(td(r.numero_serie));//saca num serie del recurso
    tr.appendChild(td(nombreCategoria));
    tr.appendChild(td(nombreModelo));
    tr.appendChild(td(nombreUbicacion));
    tr.appendChild(td(textoEstado(r.estado)));//recurso guarda el estado como un num pero lo pasa a texto con textoEstado

    //ultima celda de la fila con los botones:
    var acciones = document.createElement("td");//crea celda vacia llamad acciones y dentro iran los botones

    //boton abrir:
    var bAbrir = document.createElement("button");
    bAbrir.textContent = "Abrir";

    bAbrir.onclick = function () {
      abrirFicha(r.id);//cuando pulse el boton se ejecutara abrirFicha
      //r.id-> abrira del recurso actual (r) el q tenga el id indicado
    };
    acciones.appendChild(bAbrir);//por ultimo añade el boton dentro de la celda (que hemos llamado acciones)

    //boton borrar:
    var bBorrar = document.createElement("button");
    bBorrar.textContent = "Borrar";
    bBorrar.style.marginLeft = "6px";//añade un poco de espacio respecto al boton anterior (6 pixeles de separicion)
    //es igual q abrir
    bBorrar.onclick = function () {
      eliminarRecurso(r.id);//llama a la funcion eliminarRecurso (la siguiente)
    };
    acciones.appendChild(bBorrar);

    //Tras los botones añade la celda acciones a la fila
    tr.appendChild(acciones);
    tbody.appendChild(tr);//añade la fila completa
  });
}

function eliminarRecurso(id) {//recibe el id q quiere eliminar
  // confirm muestra una ventana con Aceptar y Cancelar
  if (!confirm("¿Seguro que quieres borrar este recurso?")) {
    return;
     // Si pulsa Cancelar:
    // confirm devuelve false
    // !false se convierte en true
    // entra en el if y termina la función sin eliminar el recurso
  }

    // Si pulsa Aceptar:
      // confirm devuelve true
      // !true se convierte en false
      // no entra en el if y continúa hasta la petición DELETE

  //envia una peticion con el id del recurso q quiere eliminar
  rest.delete("/api/recursos/" + id, function (status) {
    //si servidor no encuentra para ejecicion 
    if (status !== 200) {
      alert("No existe.");
      return;
    }
    //si lo encuentra lo elimina y vuelve a buscar los recursos para actualizar la tabla
    buscarRecursos();
  });
}

// Ficha recurso
function nuevoRecurso() { // se ejecuta al pulsar el boton Añadir Recurso
  //preparamos el formulario:
  document.getElementById("tituloFicha").innerHTML = "Nuevo recurso"; //cambia el titulo de la pantalla a nuevo recurso
  document.getElementById("msgFicha").innerHTML = ""; //borramos mensajes anteriores
  document.getElementById("recursoId").value = ""; //deja vacio el id pq aun no tiene uno

  prepararSelectsFicha();//llamamos a la funcion que rellena los desplegables con los datos guardados (categ,model,ubiuca)

  document.getElementById("rNumeroSerie").value = "";//dejo vacio el numserie para q lo rellene usuario con nuevo recurso
  document.getElementById("rEstado").value = "0";//selecciona estado inicialmente 0 (q es operativo) 

  if (cacheCategorias.length > 0) { //si la categoria es mayor q 0 =es decir hay al menos 1 cat entra en if(por ahora tenemos 1,2,3 por tanto 3>0)
    document.getElementById("rCategoria").value =
      String(cacheCategorias[0].id);
      //El indice [0] representa el primer elemento del array-> con string lo pasamos a texto
      //cuando habra el desplegable por defecto estara seleccionada la primera categoria
  }

  actualizarModelosFicha();//como hemos seleccionado categorias ahora hay que actualizar modelos

  if (cacheUbicaciones.length > 0) {//hacemos lo mismo q con categorias,comprueba que existe al menos una ubicación y selecciona la primera
    document.getElementById("rUbicacion").value =
      String(cacheUbicaciones[0].id);
  }

  //por ultimo como es un nuevo recurso muestra un array para reservas y otro para reseñas vacio
  pintarReservas([]);
  pintarResenyas([]);

  cambiarSeccion("ficha-recurso");// cambia la parte de la pagina q estoy viendo y veo ficha-recurso
}

function abrirFicha(id) { //se ejecuta al pulsar boton abrir q esta en la tabla (funcion de arriba)
  document.getElementById("tituloFicha").innerHTML = "Ficha del recurso"; //cambia el titulo de la pantalla
  document.getElementById("msgFicha").innerHTML = ""; //borra cosas anteriores

  prepararSelectsFicha(); //rellena los desplegables de cat,modelo y ubi (llama a la siguiente funcion)

  //Pide al servidor el recurso (con get) segun el id
  rest.get("/api/recursos/" + id, function (status, r) {
    if (status !== 200 || !r) {//comprueba si el servidor respode dif de 200 o no recibe un recurso detiene ejecion 
      alert("Recurso no existe");
      return;
    }
    //cliente recibe el status (si es 200) y los datos del recurso enviados por servidor:
    document.getElementById("recursoId").value = String(r.id);
    document.getElementById("rNumeroSerie").value = r.numero_serie;
    document.getElementById("rEstado").value = String(r.estado);
    document.getElementById("rUbicacion").value = String(r.ubicacion);

    //queremos q aparezca en la ficha el modelo q es pero para eso antes debemos saber su categoria
    //Recurso guarda el id del modelo (r.modelo) y con el find busca id que coincida con este
    var mod = cacheModelos.find(function (m) {
      return m.id === r.modelo;
    });
    //dado el modelo encuentrado selecciona en desplegable la categoria   
    if (mod) {
      document.getElementById("rCategoria").value =
        String(mod.categoria);

      actualizarModelosFicha();//carga los modelos de esa cat (term bssico, term pro)

      document.getElementById("rModelo").value =//selecciona el modelo del recurso que ya sabiamos y pasa a texto
        String(r.modelo);
    }

    //por ultimo pide al servidor las reservas y las reseñas del recurso 
    //si responde 200 -> las muestra (llama a la funcion de la tabla (pintar)) y si no deja la tabla vacia (array vacio)
    rest.get(
      "/api/recursos/" + r.id + "/reservas",
      function (status, reservas) {
        if (status === 200) {
          pintarReservas(reservas);
        } else {
          pintarReservas([]);
        }
      }
    );

    rest.get(
      "/api/recursos/" + r.id + "/resenyas",
      function (status, resenyas) {
        if (status === 200) {
          pintarResenyas(resenyas);
        } else {
          pintarResenyas([]);
        }
      }
    );

    cambiarSeccion("ficha-recurso"); //cambia la pantalla
  });
}

function prepararSelectsFicha() {
  var selCat = document.getElementById("rCategoria");

  selCat.innerHTML = "";

  cacheCategorias.forEach(function (c) {
    selCat.appendChild(opcion(String(c.id), c.nombre));
  });

  var selUbi = document.getElementById("rUbicacion");

  selUbi.innerHTML = "";

  cacheUbicaciones.forEach(function (u) {
    selUbi.appendChild(opcion(String(u.id), u.nombre));
  });

  actualizarModelosFicha();
}

function actualizarModelosFicha() {
  var catId = parseInt(
    document.getElementById("rCategoria").value,
    10
  );

  var selMod = document.getElementById("rModelo");

  selMod.innerHTML = "";

  cacheModelos.forEach(function (m) {
    if (m.categoria === catId) {
      selMod.appendChild(opcion(String(m.id), m.nombre));
    }
  });
}

function guardarRecurso() {
  var id = document.getElementById("recursoId").value;

  var payload = {
    modelo: parseInt(
      document.getElementById("rModelo").value,
      10
    ),
    ubicacion: parseInt(
      document.getElementById("rUbicacion").value,
      10
    ),
    numero_serie:
      document.getElementById("rNumeroSerie").value,
    estado: parseInt(
      document.getElementById("rEstado").value,
      10
    )
  };

  document.getElementById("msgFicha").innerHTML = "";

  if (id === "") {
    rest.post("/api/recursos", payload, function (status, idNuevo) {
      if (status !== 201 || idNuevo == null) {
        document.getElementById("msgFicha").innerHTML =
          "No se pudo crear.";
        return;
      }

      document.getElementById("msgFicha").innerHTML =
        "Recurso creado.";

      document.getElementById("recursoId").value =
        String(idNuevo);

      enviarAvisoRecursoCreado(idNuevo);
      buscarRecursos();
    });
  } else {
    rest.put(
      "/api/recursos/" + id,
      payload,
      function (status) {
        if (status !== 200) {
          document.getElementById("msgFicha").innerHTML =
            "No se pudo actualizar.";
          return;
        }

        document.getElementById("msgFicha").innerHTML =
          "Recurso actualizado.";

        buscarRecursos();
      }
    );
  }
}

function volverListado() {
  cambiarSeccion("menu-principal");
}

// Reservas
function pintarReservas(reservas) {
  var tbody = document.getElementById("tablaReservasBody");

  tbody.innerHTML = "";

  reservas.forEach(function (r) {
    var tr = document.createElement("tr");

    tr.className = claseReserva(r);

    var tdSan = td("Cargando...");
    tr.appendChild(tdSan);

    tr.appendChild(td(String(r.horas_estimadas)));
    tr.appendChild(td(formatearFecha(r.fecha_peticion)));
    tr.appendChild(td(formatearFecha(r.fecha_inicio)));
    tr.appendChild(td(formatearFecha(r.fecha_fin)));

    getNombreSanitario(
      r.sanitario,
      function (nombreCompleto) {
        tdSan.textContent = nombreCompleto;
      }
    );

    tbody.appendChild(tr);
  });
}

function claseReserva(r) {
  if (r.fecha_inicio == null) {
    return "fila-verde";
  }

  if (r.fecha_fin != null) {
    return "fila-blanco";
  }

  var inicio = new Date(r.fecha_inicio);
  var ahora = new Date();

  var horasTranscurridas =
    (ahora.getTime() - inicio.getTime()) /
    (1000 * 60 * 60);

  if (horasTranscurridas > r.horas_estimadas) {
    return "fila-rojo";
  }

  return "fila-azul";
}

// Reseñas
function pintarResenyas(resenyas) {
  var tbody = document.getElementById("tablaResenyasBody");

  tbody.innerHTML = "";

  resenyas.forEach(function (x) {
    var tr = document.createElement("tr");

    tr.appendChild(td(formatearFecha(x.fecha)));

    var tdSan = td("Cargando...");
    tr.appendChild(tdSan);

    tr.appendChild(td(String(x.valor)));
    tr.appendChild(td(x.descripcion || ""));

    getNombreSanitario(
      x.sanitario,
      function (nombreCompleto) {
        tdSan.textContent = nombreCompleto;
      }
    );

    tbody.appendChild(tr);
  });
}

// Helpers
function opcion(value, text) {
  var o = document.createElement("option");

  o.value = value;
  o.textContent = text;

  return o;
}

function td(text) {
  var cell = document.createElement("td");

  cell.textContent = text;

  return cell;
}

function getNombreSanitario(id, callback) {
  if (cacheSanitarios[id]) {
    callback(
      cacheSanitarios[id].nombre +
      " " +
      cacheSanitarios[id].apellidos
    );

    return;
  }

  rest.get("/api/sanitarios/" + id, function (status, s) {
    if (status !== 200 || !s) {
      callback("Sanitario");
      return;
    }

    cacheSanitarios[id] = s;

    callback(s.nombre + " " + s.apellidos);
  });
}

function textoEstado(e) {
  if (e === 0) {
    return "Operativo";
  }

  if (e === 1) {
    return "Baja/Defectuoso";
  }

  if (e === 2) {
    return "Mantenimiento";
  }

  return "";
}

function formatearFecha(f) {
  if (f == null) {
    return "";
  }

  var d = new Date(f);

  if (isNaN(d.getTime())) {
    return "";
  }

  return d.toLocaleString();
}

// WebSocket del gestor
function conectarWSGestor() {
  cerrarWS();
  if (window.location.hostname === "telemedicina-practica3.onrender.com") {
    return;
  }

  ws = new WebSocket("ws://localhost:3000");

  ws.onopen = function () {
    rest.get(
      "/api/gestores/" + gestorActualId,
      function (status, g) {
        if (status === 200 && g) {
          ws.send(JSON.stringify({
            tipo: "login",
            usuarioTipo: "gestor",
            id: gestorActualId,
            nombre: g.nombre + " " + g.apellidos
          }));
        }
      }
    );
  };

  ws.onmessage = function (event) {
    var aviso = JSON.parse(event.data);
    pintarAviso(aviso);
  };
}

function cerrarWS() {
  if (ws != null) {
    ws.close();
    ws = null;
  }
}

function pintarAviso(aviso) {
  var tbody = document.getElementById("tablaAvisosBody");

  if (!tbody) {
    return;
  }

  var tr = document.createElement("tr");

  if (aviso.color === "rojo") {
    tr.className = "fila-rojo";
  }

  if (aviso.color === "azul") {
    tr.className = "fila-azul";
  }

  if (aviso.color === "verde") {
    tr.className = "fila-verde";
  }

  tr.appendChild(
    td(new Date(aviso.fecha).toLocaleString())
  );

  tr.appendChild(td(aviso.origen));
  tr.appendChild(td(aviso.texto));

  tbody.appendChild(tr);
}

function enviarAvisoRecursoCreado(idRecurso) {
  if (ws == null || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  rest.get(
    "/api/recursos/" + idRecurso,
    function (status, r) {
      if (status !== 200 || !r) {
        return;
      }

      var modelo = cacheModelos.find(function (m) {
        return m.id === r.modelo;
      });

      var categoria = null;

      if (modelo) {
        categoria = cacheCategorias.find(function (c) {
          return c.id === modelo.categoria;
        });
      }

      var nombreCategoria = "";

      if (categoria) {
        nombreCategoria =
          categoria.nombre.toUpperCase();
      }

      var nombreModelo = "";

      if (modelo) {
        nombreModelo =
          modelo.nombre.toUpperCase();
      }

      var texto =
        "SE HA CREADO UN NUEVO RECURSO " +
        nombreCategoria +
        " MODELO " +
        nombreModelo +
        " CON CÓDIGO " +
        r.numero_serie;

      ws.send(JSON.stringify({
        tipo: "aviso",
        color: "azul",
        fecha: Date.now(),
        origen: document
          .getElementById("bienvenida")
          .textContent
          .replace("Bienvenido/a, ", ""),
        recurso: r.id,
        texto: texto
      }));
    }
  );
}

function consultarMinisterio() {
  var mensaje = document.getElementById("msgMinisterio");
  mensaje.textContent = "Consultando...";

  rest.get(
    "https://undefined.ua.es/telemedicina/api/datos",
    function (status, envios) {
      if (status !== 200 || !Array.isArray(envios)) {
        mensaje.textContent = "No se pudieron obtener los datos.";
        return;
      }

      console.log("Envíos del Ministerio:", envios);

      mensaje.textContent =
        "Se han recibido " + envios.length + " envíos.";

      pintarRankingMinisterio(envios);
    }
  );
}

function pintarRankingMinisterio(envios) {
  // La posición en el array coincide con el código del área
  var nombres = [
    "",
    "Alergología",
    "Anestesiología",
    "Cardiología",
    "Cirugía General",
    "Dermatología",
    "Aparato Digestivo",
    "Endocrinología",
    "Ginecología",
    "Hematología",
    "Medicina Interna",
    "Neumología",
    "Neurología",
    "Oftalmología",
    "Oncología",
    "Pediatría",
    "Psiquiatría",
    "Traumatología",
    "Urología"
  ];


  // Preparamos las 18 áreas, inicialmente con cero reservas
  var ranking = [];

  for (var id = 1; id <= 18; id++) {
    ranking.push({
      id_area: id,
      nombre: nombres[id],
      reservas: 0
    });
  }

  // Sumamos las reservas de cada envío a su área
  envios.forEach(function (envio) {
    var idArea = Number(envio.id_area);

    if (!Number.isInteger(idArea) || idArea < 1 || idArea > 18 ||
        !Array.isArray(envio.datos)) {
      console.warn("Envío con área o datos no válidos:", envio);
      return;
    }

    ranking[idArea - 1].reservas += envio.datos.length;
  });

  // Ordenamos de mayor a menor número de reservas
  // En caso de empate, usamos el código del área
  ranking.sort(function (a, b) {
    return b.reservas - a.reservas || a.id_area - b.id_area;
  });

  // Mostramos el resultado en la tabla
  var tbody = document.getElementById("tablaRankingBody");
  tbody.innerHTML = "";

  ranking.forEach(function (area, indice) {
    var fila = document.createElement("tr");

    fila.appendChild(td(indice + 1));
    fila.appendChild(td(area.nombre));
    fila.appendChild(td(area.reservas));

    tbody.appendChild(fila);
  });
}



// Aquí guardaremos las reservas junto con su recurso
var reservasParaMinisterio = [];

function prepararEnvioMinisterio() {
  var mensaje = document.getElementById("msgEnvioMinisterio");
  mensaje.textContent = "Recuperando reservas...";
  reservasParaMinisterio = [];
  envioMinisterio = null;

  // Pedimos todos los recursos, sin filtros
  rest.get("/api/recursos", function (status, recursos) {
    if (status !== 200 || !Array.isArray(recursos)) {
      mensaje.textContent = "No se pudieron obtener los recursos.";
      return;
    }

    var recopiladas = [];

    // Consultamos las reservas de un recurso cada vez
    function consultarSiguiente(indice) {
      // Cuando terminamos de recorrer todos los recursos:
      if (indice >= recursos.length) {
        reservasParaMinisterio = recopiladas;

        completarDatosMinisterio();
        return;
      }

      var recurso = recursos[indice];

      rest.get(
        "/api/recursos/" + recurso.id + "/reservas",
        function (status, reservas) {
          if (status !== 200 || !Array.isArray(reservas)) {
            mensaje.textContent =
              "No se pudieron obtener las reservas del recurso " +
              recurso.id + ".";
            return;
          }

          reservas.forEach(function (reserva) {
            recopiladas.push({
              reserva: reserva,
              recurso: recurso
            });
          });

          consultarSiguiente(indice + 1);
        }
      );
    }

    consultarSiguiente(0);
  });
}


var envioMinisterio = null;

function completarDatosMinisterio() {
  var mensaje = document.getElementById("msgEnvioMinisterio");
  envioMinisterio = null;

  var datos = [];

  function completarSiguiente(indice) {
    if (indice >= reservasParaMinisterio.length) {
      // Fecha de hoy en formato YYYY-MM-DD 
      var hoy = new Date();
      var fecha = hoy.getFullYear() + "-" +
        String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
        String(hoy.getDate()).padStart(2, "0");

      envioMinisterio = {
        id_area: 8,
        fecha: fecha,
        datos: datos
      };

      console.log("Envío preparado:", envioMinisterio);

      mensaje.textContent =
        "Envío preparado para el área 8 con " +
        datos.length + " reservas.";
      return;
    }

    var elemento = reservasParaMinisterio[indice];
    var reserva = elemento.reserva;
    var recurso = elemento.recurso;

    var modelo = cacheModelos.find(function (m) {
      return m.id == recurso.modelo;
    });

    var categoria = modelo && cacheCategorias.find(function (c) {
      return c.id == modelo.categoria;
    });

    if (!categoria) {
      mensaje.textContent =
        "No se encontró la categoría del recurso " + recurso.id;
      return;
    }

    rest.get(
      "/api/sanitarios/" + reserva.sanitario,
      function (status, sanitario) {
        if (status !== 200 || !sanitario) {
          mensaje.textContent =
            "No se pudo obtener el sanitario " + reserva.sanitario;
          return;
        }

        datos.push({
          nombre: sanitario.nombre,
          apellidos: sanitario.apellidos,
          "categoría": categoria.nombre,
          horas_estimadas: reserva.horas_estimadas,
          fec_pet: reserva.fecha_peticion,
          fec_ini: reserva.fecha_inicio,
          fecha_fin: reserva.fecha_fin
        });

        completarSiguiente(indice + 1);
      }
    );
  }

  completarSiguiente(0);
}

function enviarMinisterio() {
  var mensaje = document.getElementById("msgEnvioMinisterio");
  var boton = document.getElementById("btnEnviarMinisterio");

  if (envioMinisterio == null) {
    mensaje.textContent = "Primero pulsa Preparar envío.";
    return;
  }

  boton.disabled = true;
  mensaje.textContent = "Enviando...";

  rest.post(
    "https://undefined.ua.es/telemedicina/api/datos",
    envioMinisterio,
    function (status, respuesta) {
      boton.disabled = false;

      if (status < 200 || status >= 300) {
        mensaje.textContent =
          "No se pudo confirmar el envío. Código: " + status;
        return;
      }

      mensaje.textContent = "Reservas enviadas correctamente.";
      console.log("Respuesta del Ministerio:", respuesta);

      envioMinisterio = null;

      // Recuperamos los datos y actualizamos el ranking.
      consultarMinisterio();
    }
  );
}
