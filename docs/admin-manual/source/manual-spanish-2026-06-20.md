# Manual de Usuario - Consola VYVA x Cruz Roja

Version: 2026-06-20
Actualizado: 20 de junio de 2026
Descarga prevista: https://rcadmin.vyva.life/manuals/VYVA_Admin_Console_User_Manual_ES.pdf

## 1. Introducci?n
La consola VYVA x Cruz Roja es una herramienta operativa para equipos que coordinan seguimiento, llamadas, medicaci?n, campa?as y se?ales de riesgo de personas mayores atendidas por una organizaci?n de Cruz Roja.
Esta versi?n en espa?ol est? pensada para administradores y equipos de operaciones. Explica c?mo acceder, seleccionar la organizaci?n correcta, revisar clientes, coordinar personal, preparar campa?as de llamadas VYVA y trabajar con datos de seguimiento sin mezclar contactos personales con personal profesional.
- La fuente de datos operativa de la consola vive en Replit y en los servicios conectados de VYVA.
- Supabase Auth se usa solo como capa de identidad por enlace m?gico de correo.
- Las acciones de llamada, WhatsApp o contacto requieren una pasarela externa antes de ejecutar comunicaci?n real.

## 2. Acceso y roles
El acceso visible es solo por correo electr?nico. El administrador introduce su email y recibe un enlace seguro de inicio de sesi?n. Los botones de Google y Microsoft est?n ocultos por ahora.
Despu?s de iniciar sesi?n, la consola resuelve el email contra los registros de perfiles y roles del backend. Si el email no tiene acceso concedido, la consola bloquea la entrada con un mensaje claro.

| Rol | Qu? puede hacer |
| --- | --- |
| Super admin | Cambiar entre organizaciones, crear administradores de organizaci?n y revisar datos operativos seg?n contexto. No se crea desde la UI. |
| Admin de organizaci?n | Gestionar clientes, equipo, campa?as, contactos, horarios y configuraci?n de su organizaci?n. |
| Operador / coordinador | Revisar colas, perfiles y tareas permitidas. Las funciones sensibles dependen de permisos asignados. |
| Personal Cruz Roja asignado | Puede editar elementos operativos concretos cuando es responsable principal del cliente y existe consentimiento. |

## 3. Organizaci?n activa
Todo lo que se ve en la consola debe filtrarse por organizaci?n activa: panel Hoy, Clientes, Riesgo, Check-ins, Brain Coach, Medicaci?n, Campa?as, Contactos de emergencia, Personal Cruz Roja, Informes y Configuraci?n.
Por ahora hay dos organizaciones principales: Red Cross Zamora y Red Cross Leipzig. Zamora usa espa?ol por defecto; Leipzig usa alem?n por defecto. Un super admin puede cambiar de organizaci?n desde el selector superior.
- N?meros y direcciones espa?olas se asocian estrictamente a Zamora.
- N?meros y direcciones alemanas se asocian estrictamente a Leipzig.
- Si un usuario tiene acceso a una sola organizaci?n, la consola debe entrar directamente en esa organizaci?n.

## 4. Panel Hoy
El panel Hoy resume el estado operativo de la organizaci?n seleccionada. La parte superior muestra m?tricas como clientes inscritos, casos urgentes, revisi?n de operador, check-ins semanales, medicaci?n y seguimiento vencido.
El mapa debe centrarse en el pa?s y regi?n de la organizaci?n activa. Para Zamora debe mostrar Espa?a; para Leipzig debe mostrar Alemania. Las capas del mapa pueden incluir clientes, oficinas y equipo de campo.
- Las tarjetas deben abrir listas con el detalle detr?s del n?mero cuando sea posible.
- Las m?tricas deben indicar periodo y l?gica, por ejemplo check-ins semanales completados frente a esperados.
- Los filtros r?pidos ayudan a priorizar urgente, revisi?n, sin respuesta, medicaci?n y sin asignar.

## 5. Clientes
Clientes es la cola principal de personas atendidas. Sustituye la palabra ambigua Usuarios para evitar confusi?n con miembros del equipo. Desde esta p?gina se revisa riesgo, ciudad, motivo, canal, ?ltimo contacto y cobertura de cuidado.
Los administradores pueden a?adir clientes uno a uno, importarlos por CSV o usar la entrada por API cuando el onboarding telef?nico ya ha creado datos en el backend.
- A?adir cliente: abre el formulario de perfil de cuidado.
- Importar clientes: permite carga masiva por CSV siguiendo el formato definido.
- API intake: muestra la integraci?n para datos que llegan desde onboarding externo.
- La fila de un cliente abre su perfil operativo.

## 6. Perfil de cliente
El perfil del cliente re?ne datos clave, cobertura de cuidado, salud, medicaci?n, horarios de check-in y actividad reciente. Debe mostrar tel?fono, direcci?n, idioma, consentimiento, ?ltimo contacto y estado de riesgo con datos reales, no valores fijos.
Las acciones Call now, WhatsApp o Contactar deben indicar que se necesita conexi?n de pasarela cuando todav?a no existe integraci?n activa. No deben fingir que se ejecut? una acci?n.
- Datos clave: edad, idioma, canal preferido, tel?fono, direcci?n y consentimiento.
- Cobertura de cuidado: contacto de emergencia y personal Cruz Roja asignado.
- Medicaci?n y check-ins: medicamentos, horarios, frecuencia y acceso a adherencia.
- Actividad: eventos reales como ?ltimo check-in, ?ltima sesi?n Brain Coach, medicaci?n registrada y cambios de consentimiento.

## 7. Contactos de emergencia y personal Cruz Roja
La consola separa estrictamente contactos de emergencia y personal Cruz Roja. Los contactos de emergencia son familiares, vecinos, cuidadores o personas de apoyo capturadas durante onboarding, llamada entrante o formulario de cliente. El personal Cruz Roja es profesional y pertenece al equipo operativo.
La p?gina Contactos de emergencia lista contactos personales y sus atributos: nombre, relaci?n o rol, tel?fono, fuente, clientes vinculados y asignaciones. El personal Cruz Roja no debe aparecer mezclado en esa tabla.
- Un cliente puede tener varios contactos de emergencia.
- Un contacto puede estar vinculado a varios clientes.
- El contacto principal se muestra como resumen; la lista evita duplicarlo de forma confusa.
- La asignaci?n de personal Cruz Roja se hace desde el perfil o desde flujos de equipo, no desde la tabla de contactos personales.

## 8. Check-ins
Check-ins se reserva para llamadas de seguimiento o check-up calls. No debe mezclar sesiones de Brain Coach. La tabla muestra cliente, tel?fono, tipo, estado, ?ltimo check-in, frecuencia, hora preferida y acciones permitidas.
El estado debe basarse en actividad real. Si una llamada programada ya pas? y no hay registro de ?xito, debe mostrarse como perdida o pendiente seg?n la l?gica del backend. Si se confirm?, debe mostrarse como completada o confirmada.
- Los administradores y personal Cruz Roja principal pueden editar horarios cuando existe consentimiento.
- El ?ltimo check-in debe mostrar resultado: confirmado, perdido, escalado, cancelado o pendiente.
- Las m?tricas semanales deben calcular completados frente a esperados durante la semana, no solo 1/1.

## 9. Brain Coach
Brain Coach tiene su propia p?gina de sesiones. Desde all? se revisan rutinas activas y se abre el informe de actividad cognitiva del cliente, en lugar de volver al perfil general.
El informe debe mostrar promedio, sesiones completadas, preguntas totales, racha y un historial de sesiones para 7, 30 o 90 d?as. La organizaci?n activa debe filtrar estos datos correctamente.
- La p?gina de sesiones muestra frecuencia y hora preferida.
- El clic de reporte abre la vista de actividad cognitiva.
- La actividad del perfil debe mostrar la ?ltima sesi?n registrada, no simplemente que la rutina est? activa.

## 10. Medicaci?n y adherencia
Medicaci?n muestra clientes con se?ales de medicaci?n y permite abrir el calendario de adherencia por cliente. El calendario semanal conserva la l?gica de la versi?n anterior: medicamentos como filas, d?as como columnas y estados tomado, perdido, sin confirmar o pr?ximo.
Los administradores y personal Cruz Roja principal pueden a?adir, editar o eliminar medicamentos cuando tienen permiso. El formulario debe incluir nombre, dosis, prop?sito, horarios, frecuencia y si los recordatorios est?n activos.
- Las dosis pasadas sin registro deben aparecer como sin confirmar.
- Las dosis futuras se muestran como pr?ximas.
- La tarjeta de medicaci?n del perfil abre Ver adherencia.
- Las m?tricas del panel deben contar dosis sin confirmar de forma real.

## 11. Riesgo y sensores
Riesgo reemplaza la etiqueta anterior Risk queue. La p?gina prioriza clientes que requieren atenci?n por se?ales de urgencia, revisi?n, sin respuesta, medicaci?n o falta de asignaci?n.
Cada tarjeta de resumen debe tener una ayuda visible con explicaci?n de c?mo se calcula el n?mero. Sensores reemplaza la antigua etiqueta Alerts y queda preparado para dispositivos cuando el backend exista.
- Urgente: se?ales que requieren acci?n inmediata.
- Revisi?n: casos que necesitan evaluaci?n del operador.
- Sin respuesta: intentos o rutinas sin confirmaci?n.
- Medicaci?n: confirmaciones pendientes o patrones problem?ticos.
- Sin asignar: clientes sin cobertura de cuidado adecuada.

## 12. Campa?as de llamadas VYVA
Campa?as es un espacio de llamadas VYVA, no una herramienta gen?rica multicanal. El objetivo es seleccionar una plantilla, definir audiencia, revisar el guion, previsualizar destinatarios y guardar, programar o poner en cola la campa?a.
No se realizan llamadas reales hasta que exista una pasarela de voz configurada. Las campa?as crean una cola operativa lista para ejecuci?n cuando el conector est? activo.
- Plantillas: anuncio general, alerta de ola de calor, recordatorio de vacunaci?n, alerta de estafas, actualizaci?n de servicios o campa?a personalizada.
- AI assist: el admin escribe el prop?sito en pocas palabras y VYVA ayuda a generar el mensaje inicial.
- Segmentaci?n inteligente: organizaci?n, ciudad, ?rea, riesgo, condici?n de salud, proveedor asignado, tel?fono y consentimiento.
- Previsualizaci?n: muestra elegibles, omitidos y razones antes de poner en cola.

## 13. Equipo y superadmins
Team access crea miembros del equipo para acceso a la consola: operadores, coordinadores o admins. No crea clientes ni contactos de emergencia.
Los superadmins no se crean en la interfaz. Se conceden desde controles backend como VYVA_PLATFORM_ADMIN_EMAILS o profiles.is_platform_admin. Un superadmin puede crear admins por organizaci?n.
- Clientes se crean desde Clientes.
- Miembros del equipo se crean desde Team access.
- Superadmins se gestionan fuera de la UI para reducir riesgo de gobernanza.

## 14. Configuraci?n, idioma e informes
Configuraci?n permite cambiar el idioma de la consola y revisar la organizaci?n activa. Los idiomas disponibles son ingl?s, alem?n y espa?ol. Las organizaciones tienen idioma y zona horaria por defecto.
Informes re?ne la visi?n agregada ?til para coordinaci?n: campa?as, tendencias, actividad, servicios y estado operativo. Los datos siempre deben respetar la organizaci?n activa.
- Red Cross Zamora: espa?ol, Espa?a, Europe/Madrid.
- Red Cross Leipzig: alem?n, Alemania, Europe/Berlin.
- El selector de organizaci?n solo aparece cuando el usuario tiene permisos para m?s de una organizaci?n.

## 15. Reglas de seguridad y privacidad
La consola debe recoger solo la informaci?n m?nima necesaria para coordinaci?n y seguimiento. Evite registrar diagn?sticos extensos, informaci?n financiera, aseguradoras o notas cl?nicas que no sean necesarias para la operaci?n.
Los mensajes de ?xito o error no deben incluir nombres, tel?fonos, condiciones m?dicas o medicaci?n. La trazabilidad debe ser ?til sin exponer datos sensibles innecesarios.
- No guardar borradores m?dicos en almacenamiento local del navegador.
- No registrar PHI en logs o toasts.
- Confirmar consentimiento antes de editar rutinas de llamadas.
- Mantener separadas las comunicaciones reales hasta que la pasarela est? configurada.
