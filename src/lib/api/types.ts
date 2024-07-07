export type Lab = {
  id: number;
  slug: string;
  name: string;
  first_line_address: string;
  city: string;
  zipcode: string;
  collection_methods: string[];
  sample_types: string[];
};

export type Marker = {
  id: number;
  name: string;
  slug: string;
  description: string;
  lab_id: number;
  provider_id: string;
  type?: string;
  unit: any;
  price: string;
  aoe: {
    questions: {
      id: number;
      required: boolean;
      code: string;
      value: string;
      type: string;
      sequence: number;
      answers: {
        id: number;
        code: string;
        value: string;
      }[];
    }[];
  };
};

export type LabTest = {
  id: string;
  slug: string;
  name: string;
  sample_type: string;
  method: string;
  price: number;
  is_active: boolean;
  status: string;
  fasting: boolean;
  lab: Lab;
  markers?: Marker[];
  is_delegated: boolean;
};
