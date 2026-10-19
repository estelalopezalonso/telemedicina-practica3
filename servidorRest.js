//1ºcargo las librerias
var express = require('express');
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro';

//2ºcrea el servidor 
var app = express();

//3ºimporta los datos
//var datos = require('./datos');

var conexion = require('./conexion_mysql');

//lineas 12 y 13 del ejemplo
app.use(express.json()); //formato JSON para poder leerlos

// CLIENTE REST (gestor)
app.use("/appCliente",express.static('cliente_Rest'));
//Cuando alguien vaya a /appCliente, le enseño los archivos de la carpeta cliente

//CLIENTE RPC (sanitario)
app.use("/appSanitario",express.static('cliente_RPC'));
//Cuando alguien entre a /appSanitario, enséñale los archivos de la carpeta clienteRPC

// POST: iniciar sesión como gestor
app.post('/api/gestores/login', function (req, res) {
  // Recogemos el usuario y la contraseña enviados desde el formulario.
  var login = req.body.login;
  var password = req.body.password;

  // Buscamos un gestor para el que coincidan ambos datos.
  conexion.query(
    'SELECT id FROM gestores WHERE usuario = ? AND password = ?',
    [login, password],
    function (err, filas) {
      // MySQL no ha podido ejecutar la consulta.
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar el gestor' });
        return;
      }

      // La consulta funciona, pero no coinciden usuario y contraseña.
      if (filas.length === 0) {
        res.status(301).json("Usuario Incorrecto");
        return;
      }

      var contenido = {
        usuario: filas[0].id,
        expira: Date.now() + 60 * 60 * 1000
      };

      var token = jwt.encode(contenido, clave);

      res.status(200).json({
        id: filas[0].id,
        token: token
      });
      }
    );
});

// POST: registrar un gestor nuevo
app.post('/api/gestores', function (req, res) {
  var nuevo = req.body; // Datos enviados desde el formulario.

  // Primero comprobamos si ya hay un gestor con ese usuario.
  conexion.query(
    'SELECT id FROM gestores WHERE usuario = ?',
    [nuevo.usuario],
    function (err, filas) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar los gestores' });
        return;
      }

      if (filas.length > 0) {
        res.status(403).json({ error: 'Usuario ya existe' });
        return;
      }

      // Como el usuario no existe, insertamos el gestor en MySQL.
      // Los valores del array corresponden a los ? en el mismo orden.
      conexion.query(
        'INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)',
        [
          nuevo.nombre || '',
          nuevo.apellidos || '',
          nuevo.usuario || '',
          nuevo.password || ''
        ],
        function (err, resultado) {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error al crear el gestor' });
            return;
          }

          // MySQL ha generado el ID del nuevo gestor automáticamente.
          res.status(201).json(resultado.insertId);
        }
      );
    }
  );
});

// Desde aquí, todos los servicios /api requieren un token.
app.use("/api", function (req, res, next) {
  var token = req.query.token;

  if (!token) {
    res.status(301).json("No se ha encontrado token" );
    return;
  }

  try {
    var contenidoToken = jwt.decode(token, clave);
  } catch (error) {
    res.status(301).json("El token es incorrecto" );
    return;
  }

  if (!contenidoToken ||
      !contenidoToken.usuario ||
      typeof contenidoToken.expira !== "number") {
    res.status(301).json("El formato del token no es adecuado");
    return;
  }

  if (contenidoToken.expira <= Date.now()) {
    res.status(301).json("El token ha expirado" );
    return;
  }

  next();
});

// GET: ubicaciones, categorias, modelos
app.get('/api/ubicaciones', function (req, res) {
  conexion.query('SELECT * FROM ubicaciones', function(err,filas){
    if(err){
      console.error(err);
      res.status(500).json({error:'Error al consultar las ubicaciones'});
      return;
    }

  res.status(200).json(filas);
  });
});

app.get('/api/categorias', function (req, res) {
  conexion.query('SELECT * FROM categorias', function (err, filas) {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al consultar las categorías' });
      return;
    }

    res.status(200).json(filas);
  });
});

app.get('/api/modelos', function (req, res) {
  conexion.query('SELECT * FROM modelos', function(err,filas) {
    if(err){
      console.error(err);
      res.status(500).json({error:'Error al consultar los modelos'});
      return;
    }
    res.status(200).json(filas);
  });
});

//req (request) = lo que me manda el cliente (datos que llegan).
//res (response) = lo que yo devuelvo al cliente (respuesta del servidor).

// PUT: modificar los datos de un gestor
app.put('/api/gestores/:id', function (req, res) {
  var id = parseInt(req.params.id, 10); // ID que viene en la URL
  var nuevo = req.body;                  // lo que envía el cliente y quiere cambiar

  // 1. Comprobamos que el gestor existe.
  conexion.query(
    'SELECT id FROM gestores WHERE id = ?',
    // Solo necesitamos seleccionar id porque aquí únicamente comprobamos si existe
    [id],
    function (err, filas) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar el gestor' });
        return;
      }

      if (filas.length === 0) {
        res.status(404).json({ error: 'Gestor no existe' });
        return;
      }

      //gestor existe
      // 2. Preparamos solo los campos que el cliente quiere cambiar.
      var campos = []; //guarda las columnas que se modifican
      var valores = []; //guarda los nuevos valores de esas columnas

      //si han enviado un nombre lo añade a los dos array
      if (nuevo.nombre != null) {
        campos.push('nombre = ?');
        valores.push(nuevo.nombre);
      }

      if (nuevo.apellidos != null) {
        campos.push('apellidos = ?');
        valores.push(nuevo.apellidos);
      }

      if (nuevo.usuario != null) {
        campos.push('usuario = ?');
        valores.push(nuevo.usuario);
      }

      if (nuevo.password != null) {
        campos.push('password = ?');
        valores.push(nuevo.password);
      }

      // Esta función ejecutará el UPDATE cuando ya podamos hacerlo.
      function guardarCambios() {
        // Si no se envió ningún campo, no hay nada que modificar.
        if (campos.length === 0) {
          res.status(200).json({ ok: true });
          return;
        }

        // añade el ID del gestor que modificamos(es el viene en la URL)
        valores.push(id);
        //añade el id para asi saber ahora q gestor actualizar segun el id
        var sql = 'UPDATE gestores SET ' + //actualiza tabla gestores
          campos.join(', ') + //coge todo lo q hay en el array de campos
          ' WHERE id = ?'; //del gestor al q correspond ese id

        //envia la conexion MySQL con los valores actualizados
        conexion.query(sql, valores, function (err, resultado) {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error al actualizar el gestor' });
            return;
          }

          res.status(200).json({ ok: true });
        });
      }

      // 3. Si se quiere cambiar el usuario, comprobamos que
      // ningún OTRO gestor tenga ya ese nombre de usuario.
      if (nuevo.usuario != null) {
        conexion.query(
          'SELECT id FROM gestores WHERE usuario = ? AND id <> ?', //<> distinto de
          // compruba/busca si hay algun usurio igual con distinto id
          [nuevo.usuario, id],
          function (err, otrosGestores) {
            if (err) {
              console.error(err);
              res.status(500).json({ error: 'Error al consultar los usuarios' });
              return;
            }

            if (otrosGestores.length > 0) {
              res.status(403).json({ error: 'Usuario ya existe' });
              return;
            }

            // El usuario está libre: ya podemos actualizar.
            guardarCambios();
          }
        );
      } else {
        // No se cambia el usuario: actualizamos directamente.
        guardarCambios();
      }
    }
  );
});

// GET: gestor por id (sin password)
app.get('/api/gestores/:id', function (req, res) {
  var id = parseInt(req.params.id, 10);

  conexion.query(
    'SELECT id, nombre, apellidos, usuario FROM gestores WHERE id = ?',
    [id],
    function (err, filas) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar el gestor' });
        return;
      }

      if (filas.length === 0) {
        res.status(404).json({ error: 'Gestor no existe' });
        return;
      }

      res.status(200).json(filas[0]);
    }
  );
});

// GET: sanitario por id (sin password)
app.get('/api/sanitarios/:id', function (req, res) {
  var id = parseInt(req.params.id, 10);

  conexion.query(
    'SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id=?',
    [id],
    function(err,filas){
      if(err){
        console.error(err);
        res.status(500).json({error:'Error al consultar el sanitario'});
        return;
      }

      if(filas.length===0){
        res.status(404).json({error:'Sanitario no existe'});
        return;
      }
      res.status(200).json(filas[0]);
    }
  );
});

// GET /api/recursos
// Devuelve todos los recursos o solo los que cumplen los filtros de la URL.
app.get('/api/recursos', function (req, res) {

  // r es el nombre corto de "recursos" y m de "modelos".
  // Unimos las tablas porque la categoría está en modelos, no en recursos.
  // r.* significa que devolveremos las columnas del recurso.
  var sql = 'SELECT r.* FROM recursos r JOIN modelos m ON m.id = r.modelo';

  // Aquí iremos guardando los filtros SQL y sus valores.
  var condiciones = [];
  var valores = [];

  // Si la URL incluye estado y no es -1 ("Todos"), añadimos ese filtro.
  if (req.query.estado != null && req.query.estado !== '' &&
      parseInt(req.query.estado, 10) !== -1) {
    condiciones.push('r.estado = ?');                 // Filtro SQL
    valores.push(parseInt(req.query.estado, 10));    // Valor para el ?
  }

  // Hacemos lo mismo con la ubicación.
  if (req.query.ubicacion != null && req.query.ubicacion !== '' &&
      parseInt(req.query.ubicacion, 10) !== -1) {
    condiciones.push('r.ubicacion = ?');
    valores.push(parseInt(req.query.ubicacion, 10));
  }

  // Hacemos lo mismo con el modelo.
  if (req.query.modelo != null && req.query.modelo !== '' &&
      parseInt(req.query.modelo, 10) !== -1) {
    condiciones.push('r.modelo = ?');
    valores.push(parseInt(req.query.modelo, 10));
  }

  // La categoría pertenece al modelo asociado al recurso.
  // Por eso usamos m.categoria en lugar de r.categoria.
  if (req.query.categoria != null && req.query.categoria !== '' &&
      parseInt(req.query.categoria, 10) !== -1) {
    condiciones.push('m.categoria = ?');
    valores.push(parseInt(req.query.categoria, 10));
  }

  // Si hay filtros, los añadimos a la consulta unidos por AND.
  // Si no hay ninguno, la consulta queda sin WHERE y devuelve todos.
  if (condiciones.length > 0) {
    sql += ' WHERE ' + condiciones.join(' AND ');
  }

  // Ejecutamos la consulta. MySQL sustituye cada ? por su valor,
  // siguiendo el orden del array "valores".
  conexion.query(sql, valores, function (err, filas) {

    // Si MySQL no puede ejecutar la consulta, respondemos con error 500.
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al consultar los recursos' });
      return;
    }

    // Si funciona, devolvemos los recursos encontrados.
    // Si ninguno cumple los filtros, filas será [].
    res.status(200).json(filas);
  });
});

// GET: recurso por id -> igual que anteriores (es cuando le doy a abrir y me muestra los datos del recurso seleccionado)
app.get('/api/recursos/:id', function (req, res) {
  var id = parseInt(req.params.id, 10);
  
  conexion.query(
    // otra opcion seria (pq muestra todas columnas de la tabla)-> 'SELECT * FROM recursos WHERE id = ?',
    'SELECT id, modelo, ubicacion, numero_serie, estado FROM recursos WHERE id=?',
    [id],
    function(err,filas){
      if(err){
        console.error(err);
        res.status(500).json({error:'Error al consultar al recurso'});
        return;
      }

      if(filas.length===0){
        res.status(404).json({error:'Recurso no existe'});
        return;
      }
      res.status(200).json(filas[0]);
    }
  );
});

// POST: crear un recurso nuevo
app.post('/api/recursos', function (req, res) {
  // El cliente envía modelo, ubicación, número de serie y estado-> y lo guarda en nuevo
  var nuevo = req.body;

  // Guardamos esos datos en MySQL.
  // No enviamos el id porque MySQL lo genera automáticamente.
  conexion.query(
    'INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)',
    [
      parseInt(nuevo.modelo, 10),       
      parseInt(nuevo.ubicacion, 10),    
      nuevo.numero_serie || '',         
      parseInt(nuevo.estado, 10)       // conserva el valor 0
    ],
    function (err, resultado) {
      // Si falla la inserción, devolvemos un error.
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al crear el recurso' });
        return;
      }

      // Si se creó, devolvemos el id que ha generado MySQL.
      res.status(201).json(resultado.insertId);
    }
  );
});

// PUT: actualizar recurso (practicamente igual que el put de la linea 136)
app.put('/api/recursos/:id', function (req, res) {
  var id = parseInt(req.params.id, 10); //saca id de la URL
  var nuevo=req.body; //lo q cambia el cliente
  
  //1ºcomprobar recurso existe
  conexion.query(
    'SELECT id FROM recursos WHERE id=?',
    [id],
    function(err, filas){
      if(err){
        console.error(err);
        res.status(500).json({error:'error al consultar el recurso'});
        return;
      }
      if(filas.length===0){
        res.status(404).json({error:'Recurso no existe'});
        return;
      }

      //si existe el recurso...
      //2ºpreparamos los campos q van a ser modificados
      var campos=[]; //guarda las columnas q se cambian
      var valores=[]; //guarda los nuevos valores de las columnas

      //posibles cambios q puede hacer el cliente segun:
      //modelo,ubicacion,numero_serie,estado
      if(nuevo.modelo!=null){
        campos.push('modelo=?');
        valores.push(parseInt(nuevo.modelo,10));
      }

      if(nuevo.ubicacion!=null){
        campos.push('ubicacion=?');
        valores.push(parseInt(nuevo.ubicacion,10));
      }

      if(nuevo.numero_serie!=null){
        campos.push('numero_serie=?');
        valores.push(nuevo.numero_serie);
      }

      if(nuevo.estado!=null){
        campos.push('estado=?');
        valores.push(parseInt(nuevo.estado,10));
      }

      //definimos funcion que hara el update
      function guardarCambios(){
        //si no hay ningun cambio
        if (campos.length===0){
          res.status(200).json({ok: true});
          return;
        }

        //si hay cambio
        valores.push(id); //id indica recurso a modificar 
        var sql='UPDATE recursos SET '+ 
        campos.join(', ')+
        ' WHERE id =?';
        
        //ejecutas update:
        conexion.query(sql,valores,function(err,resultado){
          if(err){
            console.error(err);
            res.status(500).json({error:'error al actualizar el recurso'});
            return;
          }
          res.status(200).json({ok:true});
        });
      }
      guardarCambios();
    }
  )
});

// DELETE: borrar recurso
app.delete('/api/recursos/:id', function (req, res) {
  var id = parseInt(req.params.id, 10);//saca el id de la URL
  
  //1º compruebo q existe recurso
  conexion.query(
    'SELECT id FROM recursos WHERE id=?',
    [id],
    function(err,filas){
      if(err){
        console.error(err);
        res.status(500).json({error:'error al consultar el recurso'});
        return;
      }
      if(filas.length===0){
        res.status(404).json({error:'Recurso no existe'});
        return;
      }

      //si existe el recurso..
      //2ºborramos segun el id
      conexion.query(
        'DELETE FROM recursos WHERE id=?',
        [id],
        function(err){
          if(err){
            console.error(err);
            res.status(500).json({error:'error al borrar el recurso'});
            return;
          }
          res.status(200).json({ok:true});
        }
        
      );
    }
  );
});

// GET: reservas de un recurso
app.get('/api/recursos/:id/reservas', function (req, res) {
  var id = parseInt(req.params.id, 10);

  // Primero comprobamos si existe el recurso.
  conexion.query(
    //SOLO CONFIRMA Q EL RECURSO EXISTE, POR ESO SOLO PIDE ID (NO DEVUELVE LA TABLA DE RECURSO LUEGO)
    //Esta consulta devuelve el ID a la variable "recursos", pero no lo enviamos al cliente
    'SELECT id FROM recursos WHERE id = ?',
    [id],
    function (err, recursos) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar el recurso' });
        return;
      }

      if (recursos.length === 0) {
        res.status(404).json({ error: 'Recurso no existe' });
        return;
      }

      //hasta aqui igual que el get de recurso por id (como antes)

      // Como el recurso existe, buscamos sus reservas.
      // En la tabla reservas, la columna "recurso" guarda el ID del recurso.
      conexion.query(
        'SELECT * FROM reservas WHERE recurso = ?',
        [id],
        function (err, reservas) {
          if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error al consultar las reservas' });
            return;
          }

          // Devolvemos una lista: puede contener reservas o estar vacía ([]).
          res.status(200).json(reservas);
        }
      );
    }
  );
});

// GET: reseñas de un recurso (igual que recurso, el anterior)
app.get('/api/recursos/:id/resenyas', function (req, res) {
  var id = parseInt(req.params.id, 10);
  
  conexion.query(
    'SELECT id FROM recursos WHERE id=?',
    [id],
    function(err,recursos){
      if(err){
        console.error(err);
        res.status(500).json({error:'Error al consultar el recurso'});
        return;
      }
      if(recursos.length===0){
        res.status(404).json({error:'Recurso no existe'});
        return;
      }

      conexion.query(
        'SELECT * FROM resenyas WHERE recurso=?',
        [id],
        function(err,resenyas){
          if(err){
            console.error(err);
            res.status(500).json({error:'Error al consultar las reseñas'});
            return;
          }
          res.status(200).json(resenyas);
        }
      );
    }
  );
});


var server = app.listen(3000, function () {
  console.log("Servidor Rest en http://localhost:3000");
});

module.exports = server;