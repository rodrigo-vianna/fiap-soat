import { Order } from '../../domain/order.entity';
import { CreateOrderDto } from '../../dtos/create-order.dto';

import { OrderStatus } from '../../value-objects/order-status';
import { PaymentStatus } from './../../value-objects/payment-status';

import { OrderWithoutItemsError } from '../../errors/order-without-items.error';

import { IGetItemService } from '../interfaces/Item/get-item.service.interface';
import { ICreateOrderService } from '../interfaces/create-order.service.interface';

import { ICheckoutPort } from '../ports/checkout.port';
import { IOrderRepositoryPort } from '../ports/order-repository.port';

export class CreateOrderService implements ICreateOrderService {
	constructor(
		private readonly orderRepository: IOrderRepositoryPort,
		private readonly getItemService: IGetItemService,
		private readonly checkout: ICheckoutPort
	) {}
	async create(dto: CreateOrderDto): Promise<Order> {
		const items = await Promise.all(
			dto.itemsIds.map(async (item) => {
				const itemEntity = await this.getItemService.findById(item.id);
				return {
					quantity: item.quantity,
					price: itemEntity.price,
					id: itemEntity.id,
				};
			})
		);
		if (items.length === 0) throw new OrderWithoutItemsError();

		const data = {
			client: { id: dto.clientId },
			status: OrderStatus.AWAITING_PAYMENT,
			status_payment: PaymentStatus.PROCESSING,
			orderItems: items.map((item) => ({
				item: { id: item.id },
				price: item.price,
				quantity: item.quantity,
			})),
		};
		const order = await this.orderRepository.create(data);
		await this.checkout.doPayment(order.id, data);
		return order;
	}
}
