export enum Role {
  CLIENT = 'CLIENT',
  RESTAURANT = 'RESTAURANT',
  KITCHEN = 'KITCHEN',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum RestaurantStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
  SUSPENDED = 'SUSPENDED',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  RECEIVED_BY_RESTAURANT = 'RECEIVED_BY_RESTAURANT',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  ASSIGNED_TO_DRIVER = 'ASSIGNED_TO_DRIVER',
  DRIVER_PICKED_UP = 'DRIVER_PICKED_UP',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REJECTED = 'REJECTED',
}

export enum PaymentStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  TO_RESTAURANT = 'TO_RESTAURANT',
  AT_RESTAURANT = 'AT_RESTAURANT',
  PICKING_UP = 'PICKING_UP',
  TO_CLIENT = 'TO_CLIENT',
  DELIVERED = 'DELIVERED',
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  restaurantId?: string;
  driverId?: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  street: string;
  number: string;
  apartment?: string;
  commune: string;
  city: string;
  instructions?: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface RestaurantCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface RestaurantHours {
  id: string;
  restaurantId: string;
  dayOfWeek: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface DeliveryZone {
  id: string;
  restaurantId: string;
  name: string;
  radiusKm: number;
  baseFee: number;
  perKmFee: number;
}

export interface Promotion {
  id: string;
  restaurantId: string;
  title: string;
  description: string;
  badgeText: string;
  discountPercent: number;
  active: boolean;
}

export interface Restaurant {
  id: string;
  ownerId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  address: string;
  commune: string;
  lat: number;
  lng: number;
  phone: string;
  status: RestaurantStatus;
  acceptingOrders: boolean;
  rating: number;
  reviewCount: number;
  prepTimeMinutes: number;
  deliveryFee: number;
  minOrderAmount: number;
  commissionPercent: number;
  featured: boolean;
  promoLabel?: string;
  distanceKm?: number;
  hours: RestaurantHours[];
  deliveryZones: DeliveryZone[];
  promotions: Promotion[];
}

export interface ProductOptionChoice {
  label: string;
  priceDelta: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;
  required: boolean;
  choices: ProductOptionChoice[];
}

export interface ProductExtra {
  id: string;
  productId: string;
  name: string;
  price: number;
  available: boolean;
}

export interface ProductCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  restaurantId: string;
  productCategoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  imageUrl: string;
  ingredients: string[];
  available: boolean;
  popular: boolean;
  prepMinutes: number;
  options: ProductOption[];
  extras: ProductExtra[];
}

export interface SelectedOption {
  optionName: string;
  choiceLabel: string;
  priceDelta: number;
}

export interface SelectedExtra {
  extraId: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedOptions: SelectedOption[];
  selectedExtras: SelectedExtra[];
  notes?: string;
  unitPriceWithModifiers: number;
  lineTotal: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  selectedExtras: SelectedExtra[];
  notes?: string;
  lineTotal: number;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  actorRole: Role;
  note?: string;
  timestamp: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  orderId: string;
  tokenWs: string;
  buyOrder: string;
  sessionId: string;
  amount: number;
  authorizationCode?: string;
  paymentTypeCode?: string;
  responseCode?: number;
  cardNumberLast4?: string;
  installments: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface DriverLocation {
  id: string;
  driverId: string;
  orderId?: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  timestamp: string;
}

export interface Driver {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: 'MOTO' | 'BICICLETA' | 'AUTO';
  vehiclePlate: string;
  status: DriverStatus;
  currentLat: number;
  currentLng: number;
  rating: number;
  completedTrips: number;
  totalEarnings: number;
}

export interface Review {
  id: string;
  orderId: string;
  clientId: string;
  clientName: string;
  restaurantId: string;
  restaurantRating: number;
  driverRating: number;
  comment?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLat: number;
  restaurantLng: number;
  addressId: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
  deliveryLat: number;
  deliveryLng: number;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'WEBPAY_PLUS' | 'WEBPAY_ONECLICK';
  deliveryMethod: 'DELIVERY' | 'PICKUP';
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discountAmount: number;
  total: number;
  platformCommission: number;
  restaurantEarnings: number;
  driverEarnings: number;
  couponCode?: string;
  notes?: string;
  estimatedMinutes: number;
  distanceKm: number;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  transaction?: PaymentTransaction;
  review?: Review;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  active: boolean;
  expiresAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  role: Role;
  orderId?: string;
  orderNumber?: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PlatformSettings {
  defaultCommissionPercent: number;
  serviceFeeClp: number;
  baseDeliveryFeeClp: number;
  driverSharePercent: number;
  webpayEnvironment: 'INTEGRATION' | 'PRODUCTION';
  webpayCommerceCode: string;
  maxLocationHistoryPerOrder: number;
}
