//1ºcargo las librerias
var express = require('express');
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro';

//2ºcrea el servidor 
var app = express();

//3ºimporta los datos
//var datos = require('./datos');

//1º importa cliente supabase
const { createClient } = require('@supabase/supabase-js');

//2º configura URL y public key
const supabaseUrl = 'https://alosyxtrpjbvdwenhydt.supabase.co';
const supabaseKey = 'sb_publishable_nV4TNAO6lA5EW7_m00kYHw__G8GAHsV';
const supabase = createClient(supabaseUrl, supabaseKey);

//lineas 12 y 13 del ejemplo
app.use(express.json()); //formato JSON para poder leerlos

// CLIENTE REST (gestor)
app.use("/appCliente",express.static('cliente_Rest'));
//Cuando alguien vaya a /appCliente, le enseño los archivos de la carpeta cliente

//CLIENTE RPC (sanitario)
app.use("/appSanitario",express.static('cliente_RPC'));
//Cuando alguien entre a /appSanitario, enséñale los archivos de la carpeta clienteRPC

// POST: iniciar sesión como gestor
app.post('/api/gestores/login', async function (req, res) {
  const login = req.body.login;
  const password = req.body.password;

  try {
    const { data: gestores, error } = await supabase
      .from('gestores')
      .select('id')
      .eq('usuario', login)
      .eq('password', password);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar el gestor'
      });
    }

    if (gestores.length === 0) {
      return res.status(301).json('Usuario Incorrecto');
    }

    const contenido = {
      usuario: gestores[0].id,
      expira: Date.now() + 60 * 60 * 1000
    };

    const token = jwt.encode(contenido, clave);

    res.status(200).json({
      id: gestores[0].id,
      token: token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar el gestor'
    });
  }
});

// POST: registrar un gestor nuevo
app.post('/api/gestores', async function (req, res) {
  const nuevo = req.body;

  try {
    // Comprobamos si el usuario ya existe.
    const { data: gestores, error: errorConsulta } = await supabase
      .from('gestores')
      .select('id')
      .eq('usuario', nuevo.usuario);

    if (errorConsulta) {
      console.error(errorConsulta);
      return res.status(500).json({
        error: 'Error al consultar los gestores'
      });
    }

    if (gestores.length > 0) {
      return res.status(403).json({
        error: 'Usuario ya existe'
      });
    }

    // Insertamos el gestor y recuperamos su ID.
    const { data: gestor, error: errorInsercion } = await supabase
      .from('gestores')
      .insert({
        nombre: nuevo.nombre || '',
        apellidos: nuevo.apellidos || '',
        usuario: nuevo.usuario || '',
        password: nuevo.password || ''
      })
      .select('id')
      .single();

    if (errorInsercion) {
      console.error(errorInsercion);
      return res.status(500).json({
        error: 'Error al crear el gestor'
      });
    }

    res.status(201).json(gestor.id);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al registrar el gestor'
    });
  }
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
app.get('/api/ubicaciones', async function (req, res) {
  try {
    const { data: ubicaciones, error } = await supabase
      .from('ubicaciones')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar las ubicaciones'
      });
    }

    res.status(200).json(ubicaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar las ubicaciones'
    });
  }
});

app.get('/api/categorias', async function (req, res) {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar las categorías'
      });
    }

    res.status(200).json(categorias);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar las categorías'
    });
  }
});

app.get('/api/modelos', async function (req, res) {
  try {
    const { data: modelos, error } = await supabase
      .from('modelos')
      .select('*');

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar los modelos'
      });
    }

    res.status(200).json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar los modelos'
    });
  }
});

//req (request) = lo que me manda el cliente (datos que llegan).
//res (response) = lo que yo devuelvo al cliente (respuesta del servidor).

// PUT: modificar los datos de un gestor
app.put('/api/gestores/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);
  const nuevo = req.body;

  try {
    // Comprobamos que el gestor existe.
    const { data: gestores, error: errorConsulta } = await supabase
      .from('gestores')
      .select('id')
      .eq('id', id);

    if (errorConsulta) {
      console.error(errorConsulta);
      return res.status(500).json({
        error: 'Error al consultar el gestor'
      });
    }

    if (gestores.length === 0) {
      return res.status(404).json({
        error: 'Gestor no existe'
      });
    }

    // Si cambia el usuario, comprobamos que no lo use otro gestor.
    if (nuevo.usuario != null) {
      const { data: otrosGestores, error: errorUsuario } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', nuevo.usuario)
        .neq('id', id);

      if (errorUsuario) {
        console.error(errorUsuario);
        return res.status(500).json({
          error: 'Error al consultar los usuarios'
        });
      }

      if (otrosGestores.length > 0) {
        return res.status(403).json({
          error: 'Usuario ya existe'
        });
      }
    }

    // Recogemos únicamente los campos enviados.
    const cambios = {};

    if (nuevo.nombre != null) {
      cambios.nombre = nuevo.nombre;
    }

    if (nuevo.apellidos != null) {
      cambios.apellidos = nuevo.apellidos;
    }

    if (nuevo.usuario != null) {
      cambios.usuario = nuevo.usuario;
    }

    if (nuevo.password != null) {
      cambios.password = nuevo.password;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(200).json({ ok: true });
    }

    const { error: errorActualizacion } = await supabase
      .from('gestores')
      .update(cambios)
      .eq('id', id);

    if (errorActualizacion) {
      console.error(errorActualizacion);
      return res.status(500).json({
        error: 'Error al actualizar el gestor'
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al actualizar el gestor'
    });
  }
});

// GET: gestor por id (sin password)
app.get('/api/gestores/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    const { data: gestores, error } = await supabase
      .from('gestores')
      .select('id, nombre, apellidos, usuario')
      .eq('id', id);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar el gestor'
      });
    }

    if (gestores.length === 0) {
      return res.status(404).json({
        error: 'Gestor no existe'
      });
    }

    res.status(200).json(gestores[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar el gestor'
    });
  }
});

// GET: sanitario por id (sin password)
app.get('/api/sanitarios/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    const { data: sanitarios, error } = await supabase
      .from('sanitarios')
      .select('id, nombre, apellidos, usuario')
      .eq('id', id);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar el sanitario'
      });
    }

    if (sanitarios.length === 0) {
      return res.status(404).json({
        error: 'Sanitario no existe'
      });
    }

    res.status(200).json(sanitarios[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar el sanitario'
    });
  }
});

// GET /api/recursos
// Devuelve los recursos que cumplen los filtros.
app.get('/api/recursos', async function (req, res) {
  try {
    // Unimos con modelos para poder filtrar por categoría.
    let consulta = supabase
      .from('recursos')
      .select('id, modelo, ubicacion, numero_serie, estado, modelos!inner(categoria)');

    if (req.query.estado != null && req.query.estado !== '' &&
        parseInt(req.query.estado, 10) !== -1) {
      consulta = consulta.eq('estado', parseInt(req.query.estado, 10));
    }

    if (req.query.ubicacion != null && req.query.ubicacion !== '' &&
        parseInt(req.query.ubicacion, 10) !== -1) {
      consulta = consulta.eq('ubicacion', parseInt(req.query.ubicacion, 10));
    }

    if (req.query.modelo != null && req.query.modelo !== '' &&
        parseInt(req.query.modelo, 10) !== -1) {
      consulta = consulta.eq('modelo', parseInt(req.query.modelo, 10));
    }

    if (req.query.categoria != null && req.query.categoria !== '' &&
        parseInt(req.query.categoria, 10) !== -1) {
      consulta = consulta.eq(
        'modelos.categoria',
        parseInt(req.query.categoria, 10)
      );
    }

    const { data: recursos, error } = await consulta;

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar los recursos'
      });
    }

    // Devolvemos las mismas columnas que recibía antes el cliente.
    const resultado = recursos.map(function (recurso) {
      return {
        id: recurso.id,
        modelo: recurso.modelo,
        ubicacion: recurso.ubicacion,
        numero_serie: recurso.numero_serie,
        estado: recurso.estado
      };
    });

    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar los recursos'
    });
  }
});

// GET: recurso por id
app.get('/api/recursos/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    const { data: recursos, error } = await supabase
      .from('recursos')
      .select('id, modelo, ubicacion, numero_serie, estado')
      .eq('id', id);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al consultar el recurso'
      });
    }

    if (recursos.length === 0) {
      return res.status(404).json({
        error: 'Recurso no existe'
      });
    }

    res.status(200).json(recursos[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar el recurso'
    });
  }
});

// POST: crear un recurso nuevo
app.post('/api/recursos', async function (req, res) {
  const nuevo = req.body;

  try {
    const { data: recurso, error } = await supabase
      .from('recursos')
      .insert({
        modelo: parseInt(nuevo.modelo, 10),
        ubicacion: parseInt(nuevo.ubicacion, 10),
        numero_serie: nuevo.numero_serie || '',
        estado: parseInt(nuevo.estado, 10)
      })
      .select('id')
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Error al crear el recurso'
      });
    }

    res.status(201).json(recurso.id);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al crear el recurso'
    });
  }
});

// PUT: actualizar recurso
app.put('/api/recursos/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);
  const nuevo = req.body;

  try {
    // Comprobamos que el recurso existe.
    const { data: recursos, error: errorConsulta } = await supabase
      .from('recursos')
      .select('id')
      .eq('id', id);

    if (errorConsulta) {
      console.error(errorConsulta);
      return res.status(500).json({
        error: 'Error al consultar el recurso'
      });
    }

    if (recursos.length === 0) {
      return res.status(404).json({
        error: 'Recurso no existe'
      });
    }

    // Recogemos únicamente los campos enviados.
    const cambios = {};

    if (nuevo.modelo != null) {
      cambios.modelo = parseInt(nuevo.modelo, 10);
    }

    if (nuevo.ubicacion != null) {
      cambios.ubicacion = parseInt(nuevo.ubicacion, 10);
    }

    if (nuevo.numero_serie != null) {
      cambios.numero_serie = nuevo.numero_serie;
    }

    if (nuevo.estado != null) {
      cambios.estado = parseInt(nuevo.estado, 10);
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(200).json({ ok: true });
    }

    const { error: errorActualizacion } = await supabase
      .from('recursos')
      .update(cambios)
      .eq('id', id);

    if (errorActualizacion) {
      console.error(errorActualizacion);
      return res.status(500).json({
        error: 'Error al actualizar el recurso'
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al actualizar el recurso'
    });
  }
});

// DELETE: borrar recurso
app.delete('/api/recursos/:id', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    // Comprobamos que el recurso existe.
    const { data: recursos, error: errorConsulta } = await supabase
      .from('recursos')
      .select('id')
      .eq('id', id);

    if (errorConsulta) {
      console.error(errorConsulta);
      return res.status(500).json({
        error: 'Error al consultar el recurso'
      });
    }

    if (recursos.length === 0) {
      return res.status(404).json({
        error: 'Recurso no existe'
      });
    }

    const { error: errorBorrado } = await supabase
      .from('recursos')
      .delete()
      .eq('id', id);

    if (errorBorrado) {
      console.error(errorBorrado);
      return res.status(500).json({
        error: 'Error al borrar el recurso'
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al borrar el recurso'
    });
  }
});

// GET: reservas de un recurso
app.get('/api/recursos/:id/reservas', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    // Comprobamos que el recurso existe.
    const { data: recursos, error: errorRecurso } = await supabase
      .from('recursos')
      .select('id')
      .eq('id', id);

    if (errorRecurso) {
      console.error(errorRecurso);
      return res.status(500).json({
        error: 'Error al consultar el recurso'
      });
    }

    if (recursos.length === 0) {
      return res.status(404).json({
        error: 'Recurso no existe'
      });
    }

    // Buscamos las reservas de ese recurso.
    const { data: reservas, error: errorReservas } = await supabase
      .from('reservas')
      .select('*')
      .eq('recurso', id);

    if (errorReservas) {
      console.error(errorReservas);
      return res.status(500).json({
        error: 'Error al consultar las reservas'
      });
    }

    res.status(200).json(reservas);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar las reservas'
    });
  }
});

// GET: reseñas de un recurso
app.get('/api/recursos/:id/resenyas', async function (req, res) {
  const id = parseInt(req.params.id, 10);

  try {
    // Comprobamos que el recurso existe.
    const { data: recursos, error: errorRecurso } = await supabase
      .from('recursos')
      .select('id')
      .eq('id', id);

    if (errorRecurso) {
      console.error(errorRecurso);
      return res.status(500).json({
        error: 'Error al consultar el recurso'
      });
    }

    if (recursos.length === 0) {
      return res.status(404).json({
        error: 'Recurso no existe'
      });
    }

    // Buscamos las reseñas de ese recurso.
    const { data: resenyas, error: errorResenyas } = await supabase
      .from('resenyas')
      .select('*')
      .eq('recurso', id);

    if (errorResenyas) {
      console.error(errorResenyas);
      return res.status(500).json({
        error: 'Error al consultar las reseñas'
      });
    }

    res.status(200).json(resenyas);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar las reseñas'
    });
  }
});


var server = app.listen(3000, function () {
  console.log("Servidor Rest en http://localhost:3000");
});

module.exports = server;
