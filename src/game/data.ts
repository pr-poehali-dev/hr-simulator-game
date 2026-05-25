export const MALE_NAMES = [
  'Александр','Дмитрий','Иван','Михаил','Сергей',
  'Андрей','Алексей','Николай','Владимир','Павел',
  'Евгений','Артём','Роман','Кирилл','Виктор',
];
export const FEMALE_NAMES = [
  'Анна','Мария','Елена','Ольга','Наталья',
  'Ирина','Татьяна','Светлана','Юлия','Екатерина',
  'Алина','Дарья','Людмила','Валентина','Надежда',
];
export const LAST_NAMES_M = [
  'Иванов','Смирнов','Кузнецов','Попов','Васильев',
  'Петров','Соколов','Михайлов','Новиков','Федоров',
  'Морозов','Волков','Алексеев','Лебедев','Семёнов',
];
export const LAST_NAMES_F = [
  'Иванова','Смирнова','Кузнецова','Попова','Васильева',
  'Петрова','Соколова','Михайлова','Новикова','Федорова',
  'Морозова','Волкова','Алексеева','Лебедева','Семёнова',
];
export const POSITIONS = [
  'Ассенизатор','Сантехник','Дворник','Грузчик','Охранник',
  'Кассир','Продавец','Водитель','Курьер','Повар',
  'Электрик','Слесарь','Плотник','Маляр','Монтажник',
  'Бухгалтер','Менеджер','Секретарь','Логист','Кладовщик',
  'Программист','Дизайнер','Маркетолог','Аналитик','Юрист',
  'Врач','Учитель','Инженер','Архитектор','Экономист',
  'Переводчик','Редактор','Журналист','Фотограф','Флорист',
  'Парикмахер','Косметолог','Тренер','Психолог','Социолог',
];

export const ROOMS = [
  { id: 0, name: 'Кабинет HR', isHR: true },
  { id: 1, name: 'Отдел разработки' },
  { id: 2, name: 'Переговорная' },
  { id: 3, name: 'Бухгалтерия' },
  { id: 4, name: 'Отдел продаж' },
  { id: 5, name: 'Коридор А' },
  { id: 6, name: 'Коридор Б' },
  { id: 7, name: 'Столовая' },
  { id: 8, name: 'Туалет' },
  { id: 9, name: 'Парковка' },
];

export const ROOM_ICONS: Record<number, string> = {
  0: '👩‍💼', 1: '💻', 2: '🗣️', 3: '📊', 4: '📞',
  5: '🚶', 6: '🚶', 7: '🍽️', 8: '🚻', 9: '🚗',
};

export const APPLICANT_DESCRIPTIONS = [
  { gender: 'M', height: 'высокий', build: 'спортивный', age: 24, color: '#2563eb', skinColor: '#FDBCB4' },
  { gender: 'M', height: 'низкий', build: 'полный', age: 45, color: '#7c3aed', skinColor: '#D4956A' },
  { gender: 'M', height: 'средний', build: 'худой', age: 33, color: '#059669', skinColor: '#FDBCB4' },
  { gender: 'M', height: 'высокий', build: 'полный', age: 58, color: '#b45309', skinColor: '#8D5524' },
  { gender: 'M', height: 'средний', build: 'спортивный', age: 19, color: '#dc2626', skinColor: '#F1C27D' },
  { gender: 'F', height: 'высокая', build: 'стройная', age: 27, color: '#db2777', skinColor: '#FDBCB4' },
  { gender: 'F', height: 'низкая', build: 'худая', age: 22, color: '#7c3aed', skinColor: '#D4956A' },
  { gender: 'F', height: 'средняя', build: 'полная', age: 41, color: '#0891b2', skinColor: '#FDBCB4' },
  { gender: 'F', height: 'высокая', build: 'спортивная', age: 35, color: '#65a30d', skinColor: '#8D5524' },
  { gender: 'F', height: 'средняя', build: 'стройная', age: 62, color: '#c2410c', skinColor: '#F1C27D' },
];

export function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateResume(id: number) {
  const isMale = Math.random() > 0.5;
  const firstName = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
  const lastName = isMale ? pick(LAST_NAMES_M) : pick(LAST_NAMES_F);
  return {
    id,
    name: `${firstName} ${lastName}`,
    age: randomBetween(18, 99),
    position: pick(POSITIONS),
    gender: isMale ? 'M' : 'F',
    avatarIndex: randomBetween(0, 14),
  };
}
