/**
 * src/utils/validators.js - DTOs y Validaciones de Integridad Backend
 */
const bcrypt = require('bcryptjs');

const roleMap = {
  administrador: 'ADMIN',
  cocina: 'CHEF',
  mozo: 'WAITER',
  cajero: 'CASHIER',
  recepcionista: 'WAITER',
  cliente: 'CLIENT'
};

const dbRoleAliases = {
  admin: 'administrador',
  administrador: 'administrador',
  cocina: 'cocina',
  cocinero: 'cocina',
  chef: 'cocina',
  mozo: 'mozo',
  waiter: 'mozo',
  mesero: 'mozo',
  cajero: 'cajero',
  caja: 'cajero',
  cashier: 'cajero',
  recepcionista: 'recepcionista',
  recepcion: 'recepcionista',
  cliente: 'cliente',
  client: 'cliente',
  comensal: 'cliente'
};

const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

function publicUser(row) {
  return {
    id: `usr_${row.id_usuario}`,
    db_id: row.id_usuario,
    name: row.nombre,
    email: row.email,
    role: roleMap[row.rol] || String(row.rol || '').toUpperCase(),
    raw_role: row.rol,
    tipo_documento: row.tipo_documento,
    numero_documento: row.numero_documento || '',
    nacionalidad: row.nacionalidad || 'Peruana',
    telefono: row.telefono || '',
    shift: row.turno,
    status: row.estado,
    avatar: row.avatar || defaultAvatar,
    source: 'postgresql'
  };
}

function userDto(row) {
  return {
    id: row.id_usuario,
    id_usuario: row.id_usuario,
    name: row.nombre,
    nombre: row.nombre,
    email: row.email,
    role: roleMap[row.rol] || String(row.rol || '').toUpperCase(),
    rol: row.rol,
    tipo_documento: row.tipo_documento,
    numero_documento: row.numero_documento,
    nacionalidad: row.nacionalidad,
    telefono: row.telefono,
    shift: row.turno,
    turno: row.turno,
    status: row.estado,
    estado: row.estado,
    avatar: row.avatar || defaultAvatar,
    is_deleted: row.is_deleted,
    fecha_eliminacion: row.fecha_eliminacion,
    fecha_creacion: row.fecha_creacion,
    fecha_actualizacion: row.fecha_actualizacion
  };
}

function hasField(obj, ...keys) {
  return keys.some((k) => Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined);
}

/**
 * Valida creación o actualización parcial de usuarios preservando campos existentes.
 */
function validateUser(input = {}, isUpdate = false, existingUser = null) {
  const errors = {};
  const clean = {};

  // 1. Nombre
  if (!isUpdate || hasField(input, 'name', 'nombre')) {
    const name = String(input.name ?? input.nombre ?? '').trim();
    if (!name && !isUpdate) {
      errors.nombre = 'El nombre completo es obligatorio';
    } else if (name && (name.length < 3 || name.length > 100)) {
      errors.nombre = 'El nombre debe contener entre 3 y 100 caracteres';
    } else if (name && !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]+$/.test(name)) {
      errors.nombre = 'El nombre contiene caracteres no válidos';
    } else if (name) {
      clean.nombre = name;
    }
  }

  // 2. Correo electrónico
  if (!isUpdate || hasField(input, 'email')) {
    const email = String(input.email ?? '').trim().toLowerCase();
    if (!email && !isUpdate) {
      errors.email = 'El correo electrónico es obligatorio';
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.email = 'El correo electrónico no tiene un formato válido';
    } else if (email) {
      clean.email = email;
    }
  }

  // 3. Nacionalidad y Tipo de Documento (respetando datos previos en updates parciales)
  const effectiveNationality = hasField(input, 'nationality', 'nacionalidad')
    ? (String(input.nationality ?? input.nacionalidad ?? '').trim() || 'Peruana')
    : (existingUser?.nacionalidad || 'Peruana');

  if (!isUpdate || hasField(input, 'nationality', 'nacionalidad')) {
    clean.nacionalidad = effectiveNationality;
  }

  const peruvian = ['peruana', 'peru', 'perú'].includes(effectiveNationality.toLowerCase());

  let effectiveDocType = hasField(input, 'docType', 'tipo_documento')
    ? String(input.docType ?? input.tipo_documento ?? '').trim().toUpperCase()
    : String(existingUser?.tipo_documento || (peruvian ? 'DNI' : 'PASAPORTE')).trim().toUpperCase();

  if (!['DNI', 'PASAPORTE', 'CARNET_EXTRANJERIA', 'OTRO'].includes(effectiveDocType)) {
    effectiveDocType = peruvian ? 'DNI' : 'PASAPORTE';
  }

  if (!isUpdate || hasField(input, 'docType', 'tipo_documento')) {
    clean.tipo_documento = effectiveDocType;
  }

  // 4. Número de Documento
  if (!isUpdate || hasField(input, 'docNumber', 'numero_documento')) {
    const doc = String(input.docNumber ?? input.numero_documento ?? '').trim();
    if (doc) {
      if (effectiveDocType === 'DNI' && !/^\d{8}$/.test(doc)) {
        errors.numero_documento = 'El DNI debe contener exactamente 8 dígitos numéricos';
      } else if (effectiveDocType === 'DNI' && /^0{8}$/.test(doc)) {
        errors.numero_documento = 'El DNI no puede ser 00000000';
      } else if (effectiveDocType === 'PASAPORTE' && !/^[A-Za-z0-9]{6,12}$/.test(doc)) {
        errors.numero_documento = 'El pasaporte debe tener entre 6 y 12 caracteres alfanuméricos';
      } else if (effectiveDocType === 'CARNET_EXTRANJERIA' && !/^[A-Za-z0-9]{9,12}$/.test(doc)) {
        errors.numero_documento = 'El Carné de Extranjería debe tener entre 9 y 12 caracteres alfanuméricos';
      } else {
        clean.numero_documento = effectiveDocType === 'DNI' ? doc : doc.toUpperCase();
      }
    } else if (!isUpdate) {
      clean.numero_documento = null;
    }
  }

  // 5. Teléfono (soporta +51 9XXXXXXXX, 9XXXXXXXX e internacionales)
  if (!isUpdate || hasField(input, 'phone', 'telefono')) {
    const phone = String(input.phone ?? input.telefono ?? '').trim();
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (peruvian && !/^(?:51)?9\d{8}$/.test(digits)) {
        errors.telefono = 'El teléfono peruano debe tener 9 dígitos y comenzar con 9';
      } else if (!peruvian && !/^\+?[0-9][0-9\s-]{6,19}$/.test(phone)) {
        errors.telefono = 'El teléfono internacional no tiene un formato válido';
      } else {
        clean.telefono = peruvian ? `+51 ${digits.slice(-9)}` : phone;
      }
    } else if (!isUpdate) {
      clean.telefono = null;
    }
  }

  // 6. Rol, Turno, Estado y Avatar
  if (!isUpdate || hasField(input, 'role', 'rol')) {
    const rawRole = String(input.role ?? input.rol ?? 'mozo').toLowerCase().trim();
    clean.rol = dbRoleAliases[rawRole] || existingUser?.rol || 'mozo';
  }

  if (!isUpdate || hasField(input, 'shift', 'turno')) {
    clean.turno = String(input.shift ?? input.turno ?? 'Turno Mañana (8:00 AM - 4:00 PM)').trim() || 'Turno Mañana (8:00 AM - 4:00 PM)';
  }

  if (!isUpdate || hasField(input, 'status', 'estado')) {
    clean.estado = String(input.status ?? input.estado ?? 'Activo').trim() || 'Activo';
  }

  if (!isUpdate || hasField(input, 'avatar')) {
    clean.avatar = String(input.avatar ?? defaultAvatar).trim() || defaultAvatar;
  }

  // 7. Contraseña
  if (input.password !== undefined && input.password !== '') {
    if (String(input.password).length < 6) {
      errors.password = 'La contraseña debe tener un mínimo de 6 caracteres';
    } else {
      clean.password_hash = bcrypt.hashSync(String(input.password), 12);
    }
  } else if (!isUpdate) {
    clean.password_hash = bcrypt.hashSync('password123', 12);
  }

  return { is_valid: Object.keys(errors).length === 0, errors, data: clean };
}

module.exports = {
  roleMap,
  dbRoleAliases,
  defaultAvatar,
  publicUser,
  userDto,
  validateUser
};

