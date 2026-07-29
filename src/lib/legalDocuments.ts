export type LegalSubsection = {
  bullets?: string[];
  paragraphs?: string[];
  title: string;
};

export type LegalSection = {
  bullets?: string[];
  note?: string;
  paragraphs?: string[];
  subsections?: LegalSubsection[];
  title: string;
};

export type LegalDocumentData = {
  badge: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
  title: string;
  version: string;
};

const legalContact = {
  address: "[Domicilio completo del responsable pendiente de completar]",
  privacyEmail: "[correo de privacidad pendiente de completar]",
  responsible: "Fiscalix, [razón social o nombre del responsable pendiente de completar]",
  supportEmail: "[correo de soporte pendiente de completar]",
};

export const termsDocument: LegalDocumentData = {
  badge: "TÉRMINOS LEGALES",
  effectiveDate: "25 de julio de 2026",
  title: "Términos de servicio de Fiscalix",
  version: "Versión 1.0",
  intro: [
    "Estos Términos de servicio regulan el acceso y uso de Fiscalix, una plataforma digital de administración fiscal, financiera, documental, operativa y de apoyo a la gestión de obligaciones de usuarios, empresas y actividades económicas.",
    "Al crear una cuenta, iniciar sesión, contratar un plan, registrar información, cargar documentos, generar reportes o utilizar cualquier módulo de Fiscalix, la persona usuaria acepta estos Términos, el Aviso de privacidad y las políticas complementarias que se publiquen dentro del sitio.",
    "Este documento fue preparado como base operativa y legal para la plataforma. Debe ser revisado y validado por asesoría jurídica antes de su publicación definitiva, especialmente en los campos donde falte razón social, domicilio, datos fiscales o medios oficiales de contacto.",
  ],
  sections: [
    {
      title: "1. Identidad del proveedor y contacto",
      paragraphs: [
        `El servicio es ofrecido bajo la marca Fiscalix por ${legalContact.responsible}. El domicilio para efectos legales y de atención a usuarios es ${legalContact.address}.`,
        `Para soporte operativo, aclaraciones, solicitudes comerciales o incidencias del servicio, la persona usuaria podrá contactar a Fiscalix en ${legalContact.supportEmail}. Para asuntos relacionados con datos personales deberá utilizarse el medio indicado en el Aviso de privacidad: ${legalContact.privacyEmail}.`,
        "Antes de publicar estos Términos en producción, Fiscalix deberá sustituir los campos pendientes por la razón social o nombre del responsable, RFC, domicilio físico en México, medios de contacto verificables y, en su caso, datos de inscripción contractual ante autoridades competentes.",
      ],
    },
    {
      title: "2. Definiciones",
      bullets: [
        "Fiscalix o la Plataforma: el sitio web, paneles, módulos, APIs, bases de datos, interfaces, reportes, notificaciones y funcionalidades asociadas a la marca Fiscalix.",
        "Usuario: persona física que crea o utiliza una cuenta en Fiscalix, ya sea como cliente, administrador o superadministrador.",
        "Cliente: usuario que contrata o utiliza Fiscalix para administrar información fiscal, financiera, documental, empresarial, de nómina o de actividad económica propia o de terceros autorizados.",
        "Cuenta: perfil de acceso asociado a credenciales, correo electrónico, rol, permisos, empresa vinculada, plan y configuración de seguridad.",
        "Empresa: entidad, negocio, actividad económica, persona física con actividad empresarial, persona moral, despacho o unidad administrativa registrada dentro de Fiscalix.",
        "Contenido del usuario: datos, documentos, comprobantes, ingresos, gastos, nómina, empleados, reportes, configuraciones, RFC, regímenes fiscales, obligaciones, integraciones o cualquier información cargada por el usuario.",
        "Plan: modalidad comercial de acceso a Fiscalix, incluyendo Plan Free, Plan Básico, Plan Plus, Plan Empresarial u otros que se publiquen posteriormente.",
        "Servicios de terceros: proveedores externos de autenticación, base de datos, hospedaje, correo, pagos, almacenamiento, timbrado, integraciones, analítica, comunicaciones o infraestructura que apoyen el funcionamiento de Fiscalix.",
      ],
    },
    {
      title: "3. Naturaleza del servicio",
      paragraphs: [
        "Fiscalix es una herramienta tecnológica de apoyo para centralizar información, registrar operaciones, consultar indicadores, generar reportes, administrar comprobantes, organizar obligaciones, controlar ingresos y gastos, gestionar nómina y facilitar seguimiento fiscal y administrativo.",
        "La plataforma no sustituye la asesoría personalizada de un contador público, abogado, asesor fiscal, auditor, especialista laboral o autoridad competente. Los cálculos, reportes, estimaciones fiscales, recordatorios, alertas, gráficos y documentos generados por Fiscalix son informativos y dependen de la calidad, integridad y veracidad de los datos capturados por el usuario.",
        "Cuando Fiscalix muestre estimaciones, tasas, obligaciones, fechas, impuestos, nómina, ISR, IVA, reportes o información relacionada con cumplimiento fiscal, dicha información deberá ser revisada por el usuario y, cuando corresponda, por su asesor profesional antes de tomar decisiones, presentar declaraciones, realizar pagos, emitir comprobantes o ejecutar actos jurídicos.",
      ],
    },
    {
      title: "4. Aceptación de los Términos",
      paragraphs: [
        "El uso de Fiscalix implica la aceptación expresa de estos Términos. Si la persona usuaria no está de acuerdo, deberá abstenerse de registrarse, contratar planes, cargar información o utilizar el servicio.",
        "Cuando una persona usa Fiscalix en nombre de una empresa, cliente, patrón, colaborador, despacho o tercero, declara contar con autorización suficiente para aceptar estos Términos, cargar datos, administrar información y obligar a dicha entidad o tercero en lo que resulte aplicable.",
      ],
    },
    {
      title: "5. Registro, autenticación y seguridad de la cuenta",
      paragraphs: [
        "Para utilizar determinadas funciones es necesario crear una cuenta con nombre, apellido, correo electrónico, teléfono, contraseña y demás datos requeridos. Fiscalix podrá apoyarse en proveedores de autenticación, como Firebase u otros servicios equivalentes, para validar accesos y proteger sesiones.",
        "La persona usuaria es responsable de mantener la confidencialidad de sus credenciales, cerrar sesión en equipos compartidos, activar medidas de seguridad disponibles y notificar inmediatamente cualquier acceso no autorizado, pérdida de contraseña, sospecha de uso indebido o vulneración de seguridad.",
        "Fiscalix podrá requerir verificaciones adicionales, restablecimiento de contraseña, confirmación de identidad, bloqueo temporal o suspensión preventiva cuando detecte actividad inusual, riesgo de seguridad, posible fraude, incumplimiento de estos Términos o requerimiento legal.",
      ],
    },
    {
      title: "6. Roles y permisos",
      paragraphs: [
        "Fiscalix podrá manejar roles como cliente, administrador y superadministrador. Cada rol tendrá permisos diferenciados para consultar, crear, editar, suspender, eliminar o administrar usuarios, empresas, planes, suscripciones, información fiscal y configuraciones del sistema.",
        "Los clientes solamente deberán acceder a la información propia o aquella respecto de la cual tengan autorización. Los administradores y superadministradores deberán utilizar sus permisos de forma proporcional, documentada, profesional y limitada a las necesidades operativas, de soporte, seguridad, cumplimiento o administración de Fiscalix.",
      ],
    },
    {
      title: "7. Planes, suscripciones y alcance comercial",
      paragraphs: [
        "Fiscalix podrá ofrecer planes gratuitos y de pago con límites, beneficios, módulos, soporte, usuarios, empresas, registros, almacenamiento, exportaciones, integraciones o funcionalidades diferenciadas.",
        "El Plan Free podrá asignarse automáticamente al crear una cuenta nueva, conforme a la configuración comercial vigente en la plataforma. Fiscalix podrá modificar las características del Plan Free, limitar su uso, convertirlo en plan promocional, sustituirlo o eliminarlo, respetando los derechos adquiridos que resulten aplicables y comunicando cambios relevantes.",
        "Los precios, periodicidad, moneda, impuestos, facturación, renovaciones, promociones, descuentos, cargos, restricciones, cancelaciones, suspensiones y cambios de plan se mostrarán en la página de planes, en el flujo de contratación o en comunicaciones oficiales de Fiscalix.",
      ],
      subsections: [
        {
          title: "Pagos y facturación",
          paragraphs: [
            "Salvo que se indique lo contrario, los precios se expresarán en pesos mexicanos y podrán incluir o desglosar impuestos según corresponda. El usuario es responsable de proporcionar datos de facturación correctos y mantener actualizado su método de pago cuando se habiliten pagos en línea.",
            "Fiscalix podrá utilizar procesadores de pago externos. En tal caso, el procesamiento de tarjetas, cargos, contracargos, validaciones antifraude y autorizaciones podrá estar sujeto a los términos y avisos de dichos terceros.",
          ],
        },
        {
          title: "Falta de pago, suspensión y reactivación",
          paragraphs: [
            "Cuando exista falta de pago, pago no acreditado, contracargo, incumplimiento de condiciones comerciales o riesgo de seguridad, Fiscalix podrá suspender el acceso a funciones de pago, limitar la cuenta, colocarla en revisión o cancelar la suscripción, previa comunicación cuando resulte razonablemente posible.",
            "La reactivación podrá estar condicionada al pago de cantidades vencidas, validación de identidad, actualización de datos fiscales o cumplimiento de medidas de seguridad.",
          ],
        },
      ],
    },
    {
      title: "8. Información registrada por el usuario",
      paragraphs: [
        "El usuario es responsable de que la información que registre en Fiscalix sea lícita, exacta, completa, actualizada y suficiente para los fines que persigue. Esto incluye datos de empresa, RFC, régimen fiscal, obligaciones, ingresos, gastos, proveedores, clientes, nómina, empleados, comprobantes, reportes, integraciones y cualquier documento cargado.",
        "Fiscalix no valida de forma definitiva la autenticidad, validez fiscal, suficiencia contable, cumplimiento legal o exactitud de cada dato o documento registrado. La plataforma puede ofrecer validaciones técnicas, formatos, alertas o advertencias, pero dichas herramientas no sustituyen la revisión profesional.",
      ],
    },
    {
      title: "9. Datos de terceros cargados por usuarios",
      paragraphs: [
        "Si el usuario registra datos de trabajadores, clientes, proveedores, representantes legales, socios, administradores, contribuyentes o cualquier tercero, declara contar con base legal, consentimiento, aviso de privacidad, relación jurídica o autorización suficiente para cargar y tratar dicha información en Fiscalix.",
        "El usuario será responsable frente a dichos terceros por la información que proporcione, por la legitimidad de su tratamiento y por atender solicitudes, reclamaciones o derechos que se deriven de su propia relación jurídica con ellos, salvo cuando Fiscalix actúe directamente como responsable en términos del Aviso de privacidad.",
      ],
    },
    {
      title: "10. Módulos fiscales, financieros, nómina y reportes",
      paragraphs: [
        "Los módulos de ingresos, gastos, movimientos, impuestos, centro fiscal, comprobantes, reportes, nómina, integraciones, perfil, empresa, planes y administración están diseñados para facilitar organización y consulta de información.",
        "Los reportes PDF, gráficas, indicadores, obligaciones por generar, cálculos de IVA, ISR, nómina, balances, ingresos, egresos, resúmenes financieros y cualquier exportación generada por Fiscalix se producen con base en los datos disponibles y reglas configuradas en la plataforma.",
        "El usuario debe revisar, confirmar y corregir la información antes de usarla para declaraciones fiscales, procesos contables, decisiones comerciales, pagos de nómina, auditorías, trámites, facturación, negociaciones, cumplimiento laboral o cualquier acto con efectos jurídicos o económicos.",
      ],
    },
    {
      title: "11. Integraciones y servicios externos",
      paragraphs: [
        "Fiscalix podrá permitir conexiones con servicios externos de pago, facturación, almacenamiento, comunicación, bancos, correo, timbrado, CRM, contabilidad, nómina u otros sistemas. Algunas integraciones podrán estar disponibles únicamente como funcionalidad visual, beta, pendiente de configuración o sujeta a contratación adicional.",
        "El uso de integraciones puede requerir credenciales, tokens, permisos, autorizaciones o aceptación de términos de terceros. Fiscalix no es responsable por interrupciones, cambios, errores, costos, disponibilidad, suspensión o políticas de dichos terceros, salvo responsabilidad directa que legalmente le corresponda.",
      ],
    },
    {
      title: "12. Uso permitido y prohibiciones",
      bullets: [
        "No usar Fiscalix para actividades ilícitas, fraudulentas, engañosas, abusivas, discriminatorias o contrarias a la legislación aplicable.",
        "No cargar virus, malware, scripts maliciosos, contenido que afecte la seguridad o información respecto de la cual no se tenga autorización.",
        "No intentar acceder a cuentas, datos, módulos, APIs, infraestructura, bases de datos o información de otros usuarios.",
        "No realizar ingeniería inversa, scraping abusivo, ataques, pruebas de intrusión no autorizadas, automatizaciones que degraden el servicio o uso excesivo fuera de límites razonables.",
        "No utilizar Fiscalix para emitir información falsa, ocultar operaciones, simular cumplimiento, evadir obligaciones fiscales, laborales, comerciales o regulatorias.",
        "No compartir credenciales ni revender el acceso sin autorización expresa de Fiscalix.",
      ],
    },
    {
      title: "13. Propiedad intelectual",
      paragraphs: [
        "Fiscalix, sus interfaces, diseño, marca, logotipo, código, componentes, textos, flujos, reportes, estructura visual, documentación, gráficos, bases de conocimiento, módulos y demás elementos propios están protegidos por derechos de propiedad intelectual e industrial.",
        "El usuario conserva los derechos sobre la información y documentos que cargue, pero concede a Fiscalix una licencia limitada, no exclusiva, revocable conforme a la ley y necesaria para almacenar, procesar, respaldar, mostrar, analizar y generar resultados dentro del servicio contratado.",
      ],
    },
    {
      title: "14. Confidencialidad",
      paragraphs: [
        "Fiscalix adoptará medidas razonables para proteger la confidencialidad de la información del usuario y limitar el acceso interno a personal o proveedores que necesiten tratarla para operar, dar soporte, mantener seguridad, cumplir obligaciones legales o mejorar el servicio.",
        "El usuario también deberá tratar como confidencial cualquier información técnica, comercial, de seguridad, administrativa o no pública a la que tenga acceso por el uso de Fiscalix.",
      ],
    },
    {
      title: "15. Disponibilidad, mantenimiento y cambios del servicio",
      paragraphs: [
        "Fiscalix procurará mantener la plataforma disponible y funcional, pero no garantiza operación ininterrumpida, libre de errores, libre de incidentes o compatible con todos los navegadores, dispositivos, integraciones o configuraciones.",
        "Podrán realizarse mantenimientos, actualizaciones, cambios de diseño, mejoras de seguridad, ajustes de planes, modificaciones de módulos, corrección de errores o interrupciones temporales. Cuando sea razonable, Fiscalix comunicará cambios relevantes a los usuarios.",
      ],
    },
    {
      title: "16. Soporte y comunicaciones",
      paragraphs: [
        "Fiscalix podrá enviar notificaciones dentro de la plataforma, correos electrónicos, mensajes administrativos, alertas de seguridad, avisos de pago, recordatorios fiscales, confirmaciones de acciones, cambios de términos, actualizaciones de privacidad y comunicaciones relacionadas con el servicio.",
        "El soporte podrá variar según el plan contratado. Fiscalix podrá solicitar información adicional para diagnosticar incidencias, confirmar identidad, reproducir errores o atender solicitudes.",
      ],
    },
    {
      title: "17. Suspensión, cancelación y eliminación de cuentas",
      paragraphs: [
        "Fiscalix podrá suspender o limitar una cuenta cuando exista incumplimiento de estos Términos, riesgo de seguridad, uso indebido, información falsa, actividad sospechosa, requerimiento legal, falta de pago, afectación a terceros, vulneración de derechos o necesidad técnica razonable.",
        "Cuando una cuenta sea suspendida, el usuario podrá recibir un aviso indicando que la suspensión obedece a razones de seguridad o revisión administrativa y que debe contactar a un administrador para aclaraciones.",
        "La eliminación de una cuenta puede estar sujeta a conservación temporal de información necesaria para cumplir obligaciones legales, fiscales, contables, contractuales, administrativas, de seguridad, auditoría o defensa de derechos.",
      ],
    },
    {
      title: "18. Suspensión de cuentas y solicitudes de autoridades",
      paragraphs: [
        "Esta sección establece reglas generales aplicables a la restricción temporal de cuentas, conservación de información y atención de solicitudes realizadas por autoridades competentes en México, incluyendo la Fiscalía u otras autoridades administrativas, ministeriales, jurisdiccionales o regulatorias.",
        "La suspensión de una cuenta por investigación, revisión interna, solicitud de autoridad o medida preventiva no implica, por sí misma, que Fiscalix, NovaSoft o el cliente propietario u operador de la plataforma consideren culpable al usuario, ni constituye una determinación legal sobre los hechos investigados.",
      ],
      subsections: [
        {
          title: "Causas de suspensión temporal",
          paragraphs: [
            "Fiscalix podrá suspender temporalmente el acceso de una cuenta cuando exista falta de pago, pago no acreditado, uso posiblemente fraudulento o ilícito, riesgo para la seguridad de la cuenta, otros usuarios o la plataforma, incumplimiento de estos Términos, uso de datos falsos, suplantación de identidad, intento de vulnerar, alterar o utilizar indebidamente la plataforma, solicitud u orden de autoridad competente o petición expresa del propio usuario.",
            "La suspensión deberá impedir el inicio de sesión y podrá cerrar sesiones activas o revocar accesos, sin eliminar automáticamente la información almacenada en la cuenta.",
          ],
        },
        {
          title: "Conservación de datos durante una suspensión",
          paragraphs: [
            "Durante una suspensión, los datos vinculados a la cuenta permanecerán almacenados y protegidos. No deberán ser eliminados, alterados o modificados cuando exista una obligación contractual, fiscal, administrativa, de seguridad, de auditoría, de defensa de derechos o una solicitud de autoridad competente.",
            "Fiscalix podrá conservar respaldos, registros de acceso, movimientos, comprobantes, documentos, reportes, notificaciones, bitácoras y demás información relacionada con la cuenta, limitada al tiempo necesario para atender la causa de suspensión y las obligaciones aplicables.",
            "Cuando deje de existir una causa válida de conservación, la información deberá tratarse conforme al Aviso de privacidad, las políticas de eliminación aplicables y la legislación vigente.",
          ],
        },
        {
          title: "Solicitudes dirigidas al cliente propietario de Fiscalix",
          paragraphs: [
            "Cuando la Fiscalía u otra autoridad competente dirija una solicitud formal al cliente propietario u operador comercial de Fiscalix, el flujo general será: autoridad competente → cliente propietario de Fiscalix → NovaSoft → cliente propietario de Fiscalix → autoridad competente.",
            "En ese supuesto, el cliente propietario deberá verificar la solicitud y enviar a NovaSoft una instrucción escrita. NovaSoft actuará como proveedor técnico, preservará la información, extraerá únicamente los datos solicitados y los entregará de forma segura al cliente propietario, para que este responda oficialmente a la autoridad y obtenga el acuse o constancia correspondiente.",
            "NovaSoft no decidirá por cuenta propia entregar información cuando la solicitud esté dirigida exclusivamente al cliente propietario de Fiscalix, salvo que exista obligación legal directa, instrucción documentada o mandato emitido por autoridad competente.",
          ],
        },
        {
          title: "Solicitudes dirigidas directamente a NovaSoft",
          paragraphs: [
            "Cuando la Fiscalía u otra autoridad competente solicite información directamente a NovaSoft, el flujo general será: autoridad competente → NovaSoft → autoridad competente.",
            "NovaSoft deberá verificar que la solicitud sea formal, que provenga de una autoridad competente, que identifique al funcionario solicitante y que señale los datos del procedimiento, expediente o carpeta correspondiente. Antes de entregar información, NovaSoft podrá someter la solicitud a revisión jurídica.",
            "NovaSoft deberá preservar los datos para evitar su eliminación o modificación, informar al cliente propietario de Fiscalix cuando legalmente sea posible, entregar únicamente la información especificada, evitar entregar acceso general a la plataforma, bases de datos o cuentas de otros usuarios, utilizar medios seguros de entrega, obtener acuse o constancia de recepción y conservar una bitácora de la solicitud, responsables, fechas, destinatarios e información entregada.",
            "La simple solicitud de información no suspenderá automáticamente una cuenta. La suspensión procederá cuando sea ordenada expresamente por la autoridad, autorizada por el cliente responsable de Fiscalix o necesaria ante un riesgo urgente, verificable y proporcional para la seguridad de la plataforma u otros usuarios.",
          ],
        },
        {
          title: "Alcance limitado de la información entregada",
          paragraphs: [
            "Fiscalix y NovaSoft aplicarán el principio de entrega limitada. Solo se entregarán los datos relacionados con la cuenta, usuario, empresa, periodo, movimiento, documento o información expresamente señalada en la solicitud válida.",
            "No se entregará toda la base de datos, credenciales maestras, cuentas de administrador general, acceso a información de otros usuarios ni permisos amplios para editar o eliminar datos.",
            "Cuando legalmente sea necesario proporcionar acceso temporal, este deberá ser de solo lectura, limitado a la cuenta o información investigada, con fecha de expiración, registro de consultas y descargas, y sin permisos para modificar o eliminar información.",
          ],
        },
        {
          title: "Notificación al usuario",
          paragraphs: [
            "Fiscalix podrá notificar al usuario que su cuenta se encuentra temporalmente restringida y explicar de forma general que debe comunicarse con el área de soporte o administración correspondiente. El aviso deberá ser neutral y no deberá acusar al usuario de haber cometido un delito.",
            "Un mensaje neutral podrá indicar: “Su cuenta se encuentra temporalmente restringida. Para recibir información sobre el estado de su cuenta, comuníquese con el área de soporte de Fiscalix.”",
            "No se notificará al usuario cuando la autoridad ordene mantener la solicitud en confidencialidad, cuando la notificación pueda afectar una investigación o cuando exista una prohibición legal de informar.",
          ],
        },
        {
          title: "Reactivación de cuentas",
          paragraphs: [
            "La cuenta podrá reactivarse cuando desaparezca la causa de suspensión, el usuario regularice su pago o incumplimiento, el cliente responsable autorice la reactivación, la autoridad informe que la restricción puede levantarse o se determine que la actividad detectada no representaba un riesgo.",
            "La reactivación podrá condicionarse a validaciones de identidad, actualización de datos, cumplimiento de medidas de seguridad, confirmación administrativa o cualquier requisito razonable relacionado con la causa de suspensión.",
          ],
        },
        {
          title: "Responsabilidades de Fiscalix, NovaSoft y el cliente propietario",
          paragraphs: [
            "El cliente propietario u operador comercial de Fiscalix será responsable de la operación comercial, administrativa y legal de la plataforma frente a sus usuarios finales, salvo en aquello que corresponda directamente a NovaSoft por contrato, ley aplicable o actos propios.",
            "NovaSoft actuará como proveedor técnico y, cuando corresponda, como encargado del tratamiento de información bajo instrucciones documentadas. NovaSoft no deberá utilizar la información tratada o entregada para fines distintos a operación, soporte, mantenimiento, seguridad, cumplimiento contractual o atención de una solicitud válida.",
            "Las solicitudes de autoridades deberán ser atendidas únicamente por personal autorizado. Toda conservación, extracción o entrega de datos deberá quedar registrada y limitarse a lo estrictamente necesario.",
            "Las disposiciones anteriores constituyen reglas generales de operación y podrán ajustarse para cumplir una solicitud legal específica. Fiscalix y NovaSoft podrán solicitar la revisión de asesores jurídicos antes de suspender una cuenta, conservar información o entregar datos a una autoridad.",
          ],
        },
      ],
    },
    {
      title: "19. Cancelaciones, cambios de plan y devoluciones",
      paragraphs: [
        "El usuario podrá solicitar cancelación o cambio de plan conforme a los mecanismos disponibles en Fiscalix o los canales de soporte. Las condiciones específicas podrán depender del plan, periodo contratado, promociones, uso consumido, reglas de facturación y legislación aplicable.",
        "Fiscalix informará, antes de la contratación, las características relevantes del servicio, precio, forma de pago, periodicidad, condiciones de cancelación y medios de contacto. Lo anterior se entenderá sin perjuicio de los derechos irrenunciables que correspondan a consumidores conforme a la legislación mexicana.",
      ],
    },
    {
      title: "20. Limitación de responsabilidad",
      paragraphs: [
        "En la máxima medida permitida por la ley, Fiscalix no será responsable por daños indirectos, pérdida de utilidades, pérdida de oportunidad, interrupción de negocio, errores derivados de información incorrecta capturada por el usuario, decisiones tomadas sin revisión profesional, fallas de terceros o uso de resultados sin validación.",
        "Nada en estos Términos limita derechos irrenunciables de consumidores, responsabilidades que no puedan excluirse legalmente, obligaciones de seguridad de datos personales o daños causados por dolo, mala fe o negligencia grave cuando así lo determine la autoridad competente.",
      ],
    },
    {
      title: "21. Indemnización",
      paragraphs: [
        "El usuario acepta sacar en paz y a salvo a Fiscalix frente a reclamaciones, sanciones, daños, gastos o responsabilidades derivadas de información cargada sin autorización, incumplimiento de estos Términos, uso ilegal de la plataforma, vulneración de derechos de terceros, datos falsos o uso de Fiscalix para fines distintos a los permitidos.",
      ],
    },
    {
      title: "22. Modificaciones a estos Términos",
      paragraphs: [
        "Fiscalix podrá actualizar estos Términos para reflejar cambios legales, operativos, tecnológicos, comerciales o de seguridad. La versión vigente se publicará en el sitio y podrá indicarse la fecha de entrada en vigor.",
        "Cuando los cambios sean materiales, Fiscalix procurará notificar al usuario por medios razonables. El uso continuado del servicio después de la publicación de cambios implicará aceptación de la versión actualizada, salvo que la ley exija un consentimiento distinto.",
      ],
    },
    {
      title: "23. Ley aplicable y solución de controversias",
      paragraphs: [
        "Estos Términos se interpretarán conforme a las leyes aplicables en México. Las partes procurarán resolver cualquier controversia mediante atención directa, soporte, conciliación o medios alternativos antes de acudir a instancias formales.",
        "Cuando el usuario tenga carácter de consumidor, podrá ejercer los derechos que le reconozca la Ley Federal de Protección al Consumidor y acudir a las autoridades competentes, incluyendo PROFECO, en los supuestos que correspondan.",
      ],
    },
    {
      title: "24. Prevalencia e interpretación",
      paragraphs: [
        "Si alguna disposición de estos Términos resulta inválida, ilegal o inexigible, las demás disposiciones conservarán su validez. La omisión de Fiscalix en exigir el cumplimiento de alguna obligación no constituirá renuncia a ejercer derechos posteriormente.",
        "En caso de conflicto entre estos Términos y condiciones específicas de un plan, contrato firmado o política complementaria, prevalecerá el documento que otorgue mayor protección al usuario cuando así lo exija la legislación aplicable; en los demás casos se atenderá al documento más específico.",
      ],
    },
  ],
};

export const privacyDocument: LegalDocumentData = {
  badge: "PRIVACIDAD Y DATOS",
  effectiveDate: "25 de julio de 2026",
  title: "Aviso de privacidad integral de Fiscalix",
  version: "Versión 1.0",
  intro: [
    "Este Aviso de privacidad explica cómo Fiscalix recaba, utiliza, conserva, protege, transfiere y elimina datos personales relacionados con el uso de la plataforma.",
    "Fiscalix trata datos personales para prestar un servicio digital de administración fiscal, financiera, documental, de nómina, reportes, obligaciones, planes, suscripciones, notificaciones e integraciones.",
    "Este documento debe revisarse antes de producción por asesoría jurídica y completarse con los datos reales del responsable, domicilio, correo de privacidad, RFC y mecanismos oficiales de atención.",
  ],
  sections: [
    {
      title: "1. Responsable del tratamiento",
      paragraphs: [
        `El responsable del tratamiento de datos personales es ${legalContact.responsible}, con domicilio en ${legalContact.address}.`,
        `Para ejercer derechos, revocar consentimiento, limitar el uso de datos o presentar dudas sobre privacidad, la persona titular podrá contactar a Fiscalix en ${legalContact.privacyEmail}.`,
        "La información anterior debe completarse antes de publicar este Aviso. La identidad y domicilio del responsable son elementos esenciales del aviso de privacidad en México.",
      ],
    },
    {
      title: "2. Aviso de privacidad simplificado",
      paragraphs: [
        "Fiscalix recabará datos personales para crear y administrar cuentas, autenticar usuarios, prestar servicios digitales fiscales y financieros, registrar empresas, ingresos, gastos, comprobantes, nómina, obligaciones, reportes, suscripciones, soporte, seguridad y cumplimiento legal.",
        "Fiscalix podrá transferir datos cuando sea necesario para cumplir obligaciones legales, prestar el servicio mediante proveedores tecnológicos, procesar pagos, atender soporte, proteger derechos, realizar auditorías, ejecutar contratos o por requerimiento de autoridad competente.",
        "El aviso de privacidad integral puede consultarse en esta misma página. La persona titular puede ejercer derechos ARCO, revocar consentimiento o limitar el uso de sus datos mediante el correo de privacidad indicado.",
      ],
    },
    {
      title: "3. Datos personales que podemos recabar",
      subsections: [
        {
          title: "Datos de identificación y contacto",
          bullets: [
            "Nombre, apellido, correo electrónico, teléfono, iniciales, rol, estado de cuenta, identificador de usuario y datos de perfil.",
            "Credenciales, identificadores de autenticación, sesiones, registros de inicio de sesión y datos necesarios para recuperar o proteger la cuenta.",
          ],
        },
        {
          title: "Datos fiscales, empresariales y administrativos",
          bullets: [
            "Nombre comercial, razón social, RFC, régimen fiscal, domicilio fiscal, teléfono, correo, estado de empresa, obligaciones fiscales, fechas relevantes y datos de representantes o contactos.",
            "Información relacionada con planes, suscripciones, pagos, facturación, estado de pago, fecha próxima de facturación y notas administrativas.",
          ],
        },
        {
          title: "Datos financieros y operativos",
          bullets: [
            "Ingresos, gastos, movimientos, categorías, montos, fechas, proveedores, clientes, descripciones, comprobantes, reportes, balances, gráficas y documentos generados.",
            "Información patrimonial o financiera que el usuario capture voluntariamente para obtener control administrativo y fiscal dentro de Fiscalix.",
          ],
        },
        {
          title: "Datos de nómina y empleados",
          bullets: [
            "Nombre de empleados, puestos, departamentos, sueldos, percepciones, deducciones, periodos, estados de nómina y datos necesarios para administrar pagos o reportes internos.",
            "El usuario es responsable de contar con autorización o base legal para cargar datos de trabajadores o colaboradores.",
          ],
        },
        {
          title: "Datos técnicos y de uso",
          bullets: [
            "Dirección IP, navegador, dispositivo, sistema operativo, registros de actividad, eventos de seguridad, rutas visitadas, preferencias, cookies, identificadores técnicos y métricas de uso.",
            "Datos generados por notificaciones, descargas de PDF, exportaciones, búsquedas, filtros, integraciones o acciones administrativas.",
          ],
        },
      ],
    },
    {
      title: "4. Datos personales sensibles",
      paragraphs: [
        "Fiscalix no busca recabar datos personales sensibles de forma ordinaria. Sin embargo, el usuario podría cargar documentos o registros que contengan información sensible, como datos de salud, afiliaciones, creencias, información biométrica, datos sindicales u otros datos protegidos.",
        "Cuando el usuario cargue datos sensibles de terceros, declara contar con consentimiento expreso, base legal suficiente y avisos necesarios. Fiscalix podrá limitar, rechazar o eliminar información sensible cuando no sea necesaria para la prestación del servicio o represente riesgo legal o de seguridad.",
      ],
    },
    {
      title: "5. Finalidades primarias del tratamiento",
      bullets: [
        "Crear, validar, autenticar, administrar y proteger cuentas de usuario.",
        "Prestar funcionalidades de Fiscalix: dashboard, empresas, ingresos, gastos, movimientos, impuestos, centro fiscal, reportes, comprobantes, nómina, planes, integraciones, notificaciones, administración y perfil.",
        "Registrar, organizar, consultar y procesar información fiscal, financiera, documental, administrativa y operativa proporcionada por el usuario.",
        "Generar reportes, documentos PDF, gráficas, indicadores, resúmenes, estimaciones, alertas, obligaciones y recordatorios.",
        "Gestionar planes, suscripciones, estados de pago, facturación, soporte, incidencias, cambios de plan y comunicaciones de servicio.",
        "Proteger la seguridad de la plataforma, prevenir accesos no autorizados, investigar actividad sospechosa y atender vulneraciones.",
        "Cumplir obligaciones legales, fiscales, contables, administrativas, contractuales y requerimientos de autoridad competente.",
      ],
    },
    {
      title: "6. Finalidades secundarias",
      bullets: [
        "Enviar comunicaciones comerciales, educativas, promocionales o informativas sobre Fiscalix, siempre que sean permitidas por la ley o cuenten con consentimiento cuando corresponda.",
        "Realizar encuestas de satisfacción, análisis de producto, estadísticas internas, métricas agregadas, mejora de experiencia y desarrollo de nuevas funcionalidades.",
        "Personalizar contenidos, recomendaciones, mensajes de uso, guías, onboarding y comunicación dentro de la plataforma.",
      ],
      note: "La persona titular puede oponerse a finalidades secundarias mediante el correo de privacidad sin que ello afecte el uso de funciones indispensables del servicio.",
    },
    {
      title: "7. Consentimiento y base para el tratamiento",
      paragraphs: [
        "Al crear una cuenta, aceptar este Aviso, contratar un plan, utilizar Fiscalix o cargar información, la persona titular consiente el tratamiento de sus datos conforme a las finalidades descritas.",
        "Los datos financieros o patrimoniales podrán requerir consentimiento expreso cuando así lo exija la ley. La aceptación de Términos y Aviso, el uso activo de módulos financieros y la carga voluntaria de dicha información podrán documentar dicho consentimiento, sin perjuicio de mecanismos adicionales que Fiscalix implemente.",
        "Fiscalix también podrá tratar datos sin consentimiento cuando una disposición legal lo permita, sea necesario para cumplir una relación jurídica, atender requerimientos de autoridad, proteger derechos o cumplir obligaciones contractuales.",
      ],
    },
    {
      title: "8. Transferencias de datos",
      paragraphs: [
        "Fiscalix no vende datos personales. No obstante, podrá transferir o comunicar datos cuando sea necesario para prestar el servicio, cumplir obligaciones legales, procesar pagos, operar infraestructura, atender soporte, proteger derechos o cumplir contratos.",
      ],
      bullets: [
        "Proveedores de infraestructura, hospedaje, base de datos, autenticación, seguridad, monitoreo, correo, almacenamiento, analítica, mensajería, pagos, facturación o integraciones.",
        "Autoridades competentes cuando exista requerimiento legal, mandato judicial, obligación fiscal, administrativa, contable, laboral o de seguridad.",
        "Asesores, auditores, contadores, abogados, proveedores de soporte o consultores sujetos a confidencialidad cuando sea necesario para operar, defender derechos o cumplir obligaciones.",
        "Sociedades afiliadas, controladoras, subsidiarias, adquirentes o sucesores en caso de reestructura, fusión, adquisición, transferencia de activos o continuidad del servicio.",
        "Terceros expresamente autorizados por el usuario, como integraciones, colaboradores, administradores de cuenta o representantes.",
      ],
    },
    {
      title: "9. Encargados del tratamiento",
      paragraphs: [
        "Fiscalix podrá contratar encargados que traten datos personales por cuenta del responsable. Dichos encargados deberán tratar los datos conforme a instrucciones, medidas de seguridad, acuerdos de confidencialidad y finalidades compatibles con este Aviso.",
        "Entre los encargados pueden encontrarse proveedores de autenticación, bases de datos, infraestructura cloud, monitoreo, correo electrónico, almacenamiento, pagos, soporte, analítica o servicios técnicos necesarios para Fiscalix.",
      ],
    },
    {
      title: "10. Cookies y tecnologías similares",
      paragraphs: [
        "Fiscalix puede utilizar cookies, almacenamiento local, identificadores técnicos o tecnologías similares para mantener sesiones, recordar preferencias, reforzar seguridad, analizar uso, detectar errores y mejorar la experiencia.",
        "El usuario puede configurar su navegador para bloquear o eliminar cookies. Sin embargo, algunas funciones esenciales, como autenticación, sesiones, seguridad, preferencias o navegación, podrían dejar de funcionar correctamente.",
      ],
    },
    {
      title: "11. Conservación de datos",
      paragraphs: [
        "Fiscalix conservará los datos personales durante el tiempo necesario para cumplir las finalidades descritas, prestar el servicio, mantener la cuenta, cumplir obligaciones legales, resolver disputas, atender auditorías, proteger derechos y conservar evidencia de operaciones.",
        "Cuando los datos dejen de ser necesarios, Fiscalix procurará su eliminación, anonimización o bloqueo conforme a los plazos legales, contractuales, fiscales, contables, laborales, administrativos o de prescripción aplicables.",
        "La eliminación de una cuenta no implica necesariamente la supresión inmediata de todos los datos, cuando exista obligación legal de conservación, relación contractual pendiente, evidencia de cumplimiento, facturación, seguridad, reclamaciones o defensa jurídica.",
      ],
    },
    {
      title: "12. Seguridad de la información",
      paragraphs: [
        "Fiscalix implementará medidas administrativas, técnicas y físicas razonables para proteger datos personales contra daño, pérdida, alteración, destrucción, uso, acceso o tratamiento no autorizado.",
        "Las medidas pueden incluir controles de acceso, autenticación, roles, registros de actividad, cifrado cuando corresponda, respaldo, segmentación, monitoreo, revisión de permisos, políticas internas y limitación de acceso a personal autorizado.",
        "Ningún sistema es absolutamente infalible. El usuario debe proteger sus dispositivos, contraseñas, correos, sesiones y permisos de colaboradores.",
      ],
    },
    {
      title: "13. Vulneraciones de seguridad",
      paragraphs: [
        "Si Fiscalix identifica una vulneración de seguridad que afecte de forma significativa los derechos patrimoniales o morales de las personas titulares, procurará informar de forma oportuna conforme a la legislación aplicable.",
        "La notificación podrá incluir naturaleza del incidente, datos comprometidos, recomendaciones, acciones correctivas, medios de contacto y medidas adoptadas para mitigar riesgos, cuando dicha información sea razonablemente disponible.",
      ],
    },
    {
      title: "14. Derechos ARCO",
      paragraphs: [
        "La persona titular puede ejercer derechos de acceso, rectificación, cancelación y oposición respecto de sus datos personales. También puede revocar consentimiento o limitar el uso o divulgación de sus datos, sujeto a excepciones legales.",
        `Para ejercer derechos ARCO deberá enviar solicitud a ${legalContact.privacyEmail}, indicando nombre, medio para recibir respuesta, descripción clara del derecho que desea ejercer, datos respecto de los cuales ejerce el derecho y documentos para acreditar identidad o representación legal.`,
        "Fiscalix responderá dentro de los plazos previstos por la legislación aplicable. De forma referencial, la normativa mexicana contempla respuesta en un plazo de veinte días y, si procede, ejecución dentro de los quince días siguientes, con posibilidad de ampliación en casos justificados.",
      ],
    },
    {
      title: "15. Requisitos de solicitudes ARCO",
      bullets: [
        "Nombre de la persona titular y medio para recibir notificaciones.",
        "Documento que acredite identidad y, en su caso, personalidad del representante legal.",
        "Descripción clara y precisa de los datos personales respecto de los que se busca ejercer el derecho, salvo acceso.",
        "Descripción del derecho ARCO que se pretende ejercer o solicitud concreta.",
        "Cualquier elemento que facilite localizar la información dentro de Fiscalix, como correo de cuenta, empresa vinculada, fecha aproximada o módulo relacionado.",
      ],
    },
    {
      title: "16. Revocación del consentimiento y limitación de uso",
      paragraphs: [
        "La persona titular puede revocar su consentimiento para tratamientos no indispensables o solicitar limitación del uso o divulgación de datos. Fiscalix atenderá la solicitud cuando sea procedente y no exista obligación legal, contractual o técnica que impida la revocación.",
        "La revocación puede limitar o impedir el uso de ciertas funciones cuando los datos sean necesarios para prestar el servicio, autenticar la cuenta, cumplir obligaciones, generar reportes, administrar suscripciones o proteger seguridad.",
      ],
    },
    {
      title: "17. Menores de edad",
      paragraphs: [
        "Fiscalix no está dirigido a menores de edad. El registro y uso de la plataforma debe realizarse por personas con capacidad legal suficiente o por representantes autorizados.",
        "Si Fiscalix detecta datos de menores cargados sin justificación, autorización o necesidad relacionada con el servicio, podrá solicitar aclaraciones, limitar el tratamiento o eliminar dicha información.",
      ],
    },
    {
      title: "18. Datos de empleados, clientes, proveedores y terceros",
      paragraphs: [
        "Cuando el usuario carga datos de empleados, clientes, proveedores, representantes, socios, contribuyentes u otros terceros, actúa como responsable frente a dichos terceros respecto de la obtención, legitimidad, información previa, consentimiento y exactitud de los datos.",
        "Fiscalix tratará esos datos para prestar el servicio al usuario, sin perjuicio de obligaciones propias que legalmente le correspondan por su intervención como proveedor tecnológico.",
      ],
    },
    {
      title: "19. Decisiones automatizadas y analítica",
      paragraphs: [
        "Fiscalix puede generar alertas, clasificaciones, cálculos, gráficas, recordatorios, sugerencias o indicadores automatizados con base en la información registrada. Estas salidas son herramientas de apoyo y no constituyen decisiones definitivas con efectos jurídicos por sí mismas.",
        "El usuario debe revisar los resultados antes de tomar decisiones fiscales, contables, laborales, comerciales o legales.",
      ],
    },
    {
      title: "20. Transferencias internacionales y nube",
      paragraphs: [
        "Algunos proveedores tecnológicos de Fiscalix pueden operar infraestructura fuera de México. En esos casos, Fiscalix procurará que el tratamiento se realice conforme a medidas contractuales, técnicas y organizativas razonables, y con finalidades compatibles con este Aviso.",
        "El uso de servicios cloud, autenticación, base de datos, correo, pagos o analítica puede implicar almacenamiento, respaldo o procesamiento en jurisdicciones distintas a México.",
      ],
    },
    {
      title: "21. Cambios al Aviso de privacidad",
      paragraphs: [
        "Fiscalix podrá modificar este Aviso para reflejar cambios legales, técnicos, comerciales, operativos o de seguridad. La versión vigente se publicará en esta página y señalará fecha de actualización.",
        "Cuando existan cambios sustanciales, Fiscalix procurará informarlos por medios razonables, como notificación en plataforma, correo electrónico o aviso visible en el sitio.",
      ],
    },
    {
      title: "22. Autoridad competente y reclamaciones",
      paragraphs: [
        "Si la persona titular considera que su derecho a la protección de datos personales ha sido vulnerado, podrá acudir ante la autoridad competente en materia de protección de datos personales en México, conforme a la normativa vigente.",
        "Fiscalix recomienda contactar primero al correo de privacidad para intentar atender cualquier duda, aclaración, rectificación, revocación o inconformidad de manera directa y documentada.",
      ],
    },
    {
      title: "23. Contacto de privacidad",
      paragraphs: [
        `Correo de privacidad: ${legalContact.privacyEmail}.`,
        `Correo de soporte: ${legalContact.supportEmail}.`,
        `Domicilio del responsable: ${legalContact.address}.`,
        "Estos datos deben completarse con información oficial y verificable antes de publicar el Aviso en producción.",
      ],
    },
  ],
};
