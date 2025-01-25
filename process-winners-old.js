const sequelize = require('./config/database');
const Ticket = require('./models/ticket.model');
const Winner = require('./models/winner.model');
const winston = require('winston');
const path = require('path');

// Configurar el logger con timestamp
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(), // Log en consola
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'process.log'), // Archivo donde se guardarán los logs
      level: 'info', // Nivel de log que se guardará en el archivo
    }),
  ],
});

function desordenarArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generar el arreglo de participantes basado en opciones
function generarParticipantesPorOpciones(participantes, forMeetAndGreet) {
  const participantesArray = [];
  participantes.forEach((participante) => {
    // const { dataValues } = participante;
    let optionsCount = Number(participante.total_options);

    if (forMeetAndGreet) {
      optionsCount = Math.floor(optionsCount / 10);
    }

    for (let i = 0; i < optionsCount; i++) {
      participantesArray.push(participante.client_id);
    }
  });
  return participantesArray;
}

// Excluir ganadores
function excluirGanadores(participantesArray, ganadores) {
  return participantesArray.filter((participante) => !ganadores.includes(participante));
}

// Seleccionar ganadores aleatoriamente
function seleccionarGanadores(participantesArray, count) {
  const shuffled = desordenarArray(participantesArray);
  const uniqueGanadores = new Set();

  for (const participante of shuffled) {
    if (!uniqueGanadores.has(participante)) {
      uniqueGanadores.add(participante);
      if (uniqueGanadores.size === count) break;
    }
  }

  return Array.from(uniqueGanadores);
}

// Guardar ganadores en la base de datos
async function guardarGanadores(ganadoresId, awardType) {
  const ganadoresData = ganadoresId.map((id) => ({
    client_id: id,
    award_type: awardType,
  }));
  await Winner.bulkCreate(ganadoresData);
}

// Procesar los ganadores
async function procesarGanadores() {
  logger.info('Iniciando proceso de ganadores - sorteo Messi 2025.');

  try {
    logger.info(`Obteniendo participantes...`);

    await sequelize.authenticate();

    const participantes = await Ticket.findAll({
      attributes: [
        'client_id',
        [sequelize.fn('SUM', sequelize.col('option')), 'total_options'],
      ],
      where: sequelize.literal('option > 0'),
      group: ['client_id'],
      raw: true
    });

    logger.info(`${participantes.length} Participantes: ${JSON.stringify(participantes)}`);

    const participantesOpcionesMG = generarParticipantesPorOpciones(participantes, true);
    logger.info(`Participantes por opciones para M&G: ${JSON.stringify(participantesOpcionesMG)}`);

    logger.info(`Procesando primer sorteo`);

    const titularGanadoresMG = seleccionarGanadores(participantesOpcionesMG, 5);
    logger.info(`M&G Titulares - ${titularGanadoresMG.length} ganadores: ${JSON.stringify(titularGanadoresMG)}`);

    await guardarGanadores(titularGanadoresMG, 'M&G Titulares');

    logger.info(`Procesando segundo sorteo`);

    let participantesSuplentesMG = excluirGanadores(participantesOpcionesMG, titularGanadoresMG);
    const suplenteGanadoresMG = seleccionarGanadores(participantesSuplentesMG, 20);
    await guardarGanadores(suplenteGanadoresMG, 'M&G Suplentes');
    logger.info(`M&G Suplentes - ${suplenteGanadoresMG.length} ganadores: ${JSON.stringify(suplenteGanadoresMG)}`);

    let participantesEntradas = generarParticipantesPorOpciones(participantes, false);
    participantesEntradas = excluirGanadores(participantesEntradas, titularGanadoresMG);
    logger.info(`Participantes por opciones para Entradas: ${JSON.stringify(participantesEntradas)}`);

    logger.info(`Procesando tercer sorteo`);

    const titularGanadoresEntradas = seleccionarGanadores(participantesEntradas, 50);
    await guardarGanadores(titularGanadoresEntradas, 'Entradas Titulares');
    logger.info(`Entradas Titulares - ${titularGanadoresEntradas.length} ganadores: ${JSON.stringify(titularGanadoresEntradas)}`);

    logger.info(`Procesando cuarto sorteo`);

    let participantesSuplentesEntradas = excluirGanadores(participantesEntradas, titularGanadoresEntradas);
    const suplenteGanadoresEntradas = seleccionarGanadores(participantesSuplentesEntradas, 100);
    await guardarGanadores(suplenteGanadoresEntradas, 'Entradas Suplentes');
    logger.info(`Entradas Suplentes - ${suplenteGanadoresEntradas.length} ganadores: ${JSON.stringify(suplenteGanadoresEntradas)}`);

  } catch (error) {
    logger.error(`Error en el proceso: ${error.message}`);
  } finally {
    await sequelize.close();
    logger.info('Fin del proceso de ganadores - sorteo Messi 2025.');
  }
}

procesarGanadores();
