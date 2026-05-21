export type EquipmentMedia = {
  imageSrc?: string;
  imageAlt: string;
};

const EQUIPMENT_MEDIA: Record<string, EquipmentMedia> = {
  烧杯: { imageSrc: '/equipment/beaker.jpg', imageAlt: '烧杯照片' },
  玻璃棒: { imageSrc: '/equipment/glassrod.jpg', imageAlt: '玻璃棒照片' },
  试管: { imageSrc: '/equipment/testtube.jpg', imageAlt: '试管照片' },
  锥形瓶: { imageSrc: '/equipment/flask.jpg', imageAlt: '锥形瓶照片' },
  酒精灯: { imageSrc: '/equipment/alcohol-lamp.jpg', imageAlt: '酒精灯照片' },
  滴定管: { imageSrc: '/equipment/burette.jpg', imageAlt: '滴定管照片' },
  过滤漏斗: { imageSrc: '/equipment/funnel.jpg', imageAlt: '过滤漏斗照片' },
  蒸馏导管: { imageSrc: '/equipment/tube.jpg', imageAlt: '蒸馏导管照片' },
  试管架: { imageSrc: '/equipment/testtube-rack.jpg', imageAlt: '试管架照片' },
  移液管: { imageSrc: '/equipment/pipette.jpg', imageAlt: '移液管照片' },
};

export function getEquipmentMedia(name: string): EquipmentMedia {
  return EQUIPMENT_MEDIA[name] || { imageAlt: name };
}
