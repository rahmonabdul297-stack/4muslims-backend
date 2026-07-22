export interface IAddress {
  _id?: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  isDefault: boolean;
  recipientName?: string;
  recipientPhone?: string;
}
