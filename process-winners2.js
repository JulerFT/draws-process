const sequelize = require('./config/database');
const Ticket = require('./models/ticket.model');
const Winner = require('./models/winner.model');
const WinnerFinish = require('./models/winner-finish.model');

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
      filename: path.join(__dirname, 'logs', 'process2.log'), // Archivo donde se guardarán los logs
      level: 'info', // Nivel de log que se guardará en el archivo
    }),
  ],
});

function barajar(array) {
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
  const ganadoresSet = new Set(ganadores);
  return participantesArray.filter(participante => !ganadoresSet.has(participante));
}

logger.separator = () => console.log('\n');

// Seleccionar ganadores aleatoriamente
function seleccionarGanadores(participantesArray, count) {
  let opcionesParticipantes = barajar([...participantesArray]);
  
  logger.info(`Barajada de Participantes por opciones: \n ${JSON.stringify(opcionesParticipantes)}`);
  logger.info(`Seleccionando ganadores aleatoriamente...`);

  const ganadores = [];

  for (let index = 0; index < count; index++) {
    if (opcionesParticipantes.length === 0) {
      break; // Salir del bucle si ya no hay participantes
    }
    
    const randomIndex = Math.floor(Math.random() * opcionesParticipantes.length);
    
    const ganador = opcionesParticipantes[randomIndex];
    ganadores.push(ganador);

    opcionesParticipantes = opcionesParticipantes.filter(participante => participante !== ganador);

    const ultimaVuelta = (index + 1) === count; 
    if(!ultimaVuelta){
      // Volver a desordenar el array restante
      opcionesParticipantes = barajar(opcionesParticipantes);
    }
  }

  return {ganadores, perdedores: opcionesParticipantes};
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
  logger.info('INICIO DEL SORTEO');
  logger.separator();

  try {
    logger.info(`Obteniendo participantes...`);

    await sequelize.authenticate();

    // const ganadoresFinales = await WinnerFinish.findAll({
    //   attributes: [
    //     sequelize.literal('COUNT(id)')
    //   ],
    //   raw: true
    // });

    // if(ganadoresFinales.length > 0){
    //   logger.error(`Ya se realizó el sorteo`);
    //   return;
    // }

    const participantes = await Ticket.findAll({
      attributes: [
        'client_id',
        [sequelize.fn('SUM', sequelize.col('option')), 'total_options'],
      ],
      where: sequelize.literal('option > 0'),
      group: ['client_id'],
      raw: true
    });

    logger.info(`${participantes.length} Participantes: \n ${JSON.stringify(participantes)}`);
    logger.separator();

    /****************** PRIMER SORTEO *****************************************/

    logger.info(`PROCENSANDO PRIMER SORTEO - M&G TITULARES`);
    logger.separator();

    const participantesOpcionesMG = generarParticipantesPorOpciones(participantes, true);
    logger.info(`Participantes por cantidad de opciones: \n ${JSON.stringify(participantesOpcionesMG)}`);

    const {ganadores: titularGanadoresMG, perdedores: participantesSuplentesMG} = seleccionarGanadores(participantesOpcionesMG, 5);    
    await guardarGanadores(titularGanadoresMG, 'M&G Titulares');
    logger.info(`${titularGanadoresMG.length} ganadores: ${JSON.stringify(titularGanadoresMG)}`);
    logger.info(`Resto de Participantes por opciones (Perdedores): \n ${JSON.stringify(participantesSuplentesMG)}`);
    logger.separator();

    /****************************************************************************/


    /****************** SEGUNDO SORTEO *****************************************/

    logger.info(`PROCENSANDO SEGUNDO SORTEO - M&G SUPLENTES`);
    logger.separator();

    const {ganadores: suplenteGanadoresMG} = seleccionarGanadores(participantesSuplentesMG, 20);
    await guardarGanadores(suplenteGanadoresMG, 'M&G Suplentes');
    logger.info(`${suplenteGanadoresMG.length} ganadores: ${JSON.stringify(suplenteGanadoresMG)}`);
    logger.separator();

    /****************************************************************************/

    /****************** TERCER SORTEO *****************************************/
    logger.info(`PROCENSANDO TERCER SORTEO - ENTRADAS`);
    logger.separator();

    let participantesEntradas = generarParticipantesPorOpciones(participantes, false);
    participantesEntradas = excluirGanadores(participantesEntradas, titularGanadoresMG);
    logger.info(`Participantes por cantidad de opciones: \n ${JSON.stringify(participantesEntradas)}`);

    const {ganadores: titularGanadoresEntradas, perdedores: participantesSuplentesEntradas} = seleccionarGanadores(participantesEntradas, 50);
    await guardarGanadores(titularGanadoresEntradas, 'Entradas Titulares');
    logger.info(`${titularGanadoresEntradas.length} ganadores: ${JSON.stringify(titularGanadoresEntradas)}`);
    logger.info(`Resto de Participantes por opciones (Perdedores): \n ${JSON.stringify(participantesSuplentesEntradas)}`);
    logger.separator();

    /****************************************************************************/


    /****************** CUARTO SORTEO *****************************************/

    logger.info(`PROCENSANDO CUARTO SORTEO - ENTRADAS SUPLENTES`);
    logger.separator();

    const {ganadores: suplenteGanadoresEntradas} = seleccionarGanadores(participantesSuplentesEntradas, 100);
    await guardarGanadores(suplenteGanadoresEntradas, 'Entradas Suplentes');
    logger.info(`${suplenteGanadoresEntradas.length} ganadores: ${JSON.stringify(suplenteGanadoresEntradas)}`);
    logger.separator();

    /****************************************************************************/

  } catch (error) {
    logger.error(`Error en el proceso: ${error.message}`);
  } finally {
    await sequelize.close();
    logger.info('FIN DEL SORTEO');
  }
}

procesarGanadores();