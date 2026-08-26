export type SpecificationField = { key: string; label: string; multiline?: boolean };
export type SpecificationSection = { title: string; fields: SpecificationField[] };

const fields = (values: Array<[string, string, boolean?]>): SpecificationField[] => values.map(([key, label, multiline]) => ({ key, label, multiline }));

export const rvSpecificationSections: SpecificationSection[] = [
  { title: "RV Type & Floorplan", fields: fields([["productLine", "Product Line"], ["series", "Series"], ["floorplan", "Floorplan"], ["rvType", "RV Type"], ["trim", "Trim"]]) },
  { title: "Weight & Towing", fields: fields([["dryWeight", "Dry Weight"], ["shippingWeight", "Shipping Weight"], ["uvw", "UVW"], ["gvwr", "GVWR"], ["carryingCapacity", "Carrying Capacity"], ["ccc", "CCC"], ["hitchWeight", "Hitch Weight"], ["tongueWeight", "Tongue Weight"], ["towingCapacity", "Towing Capacity"]]) },
  { title: "Dimensions", fields: fields([["overallLength", "Overall Length"], ["exteriorWidth", "Exterior Width"], ["exteriorHeight", "Exterior Height"], ["interiorHeight", "Interior Height"], ["wheelbase", "Wheelbase"]]) },
  { title: "Tanks & Propane", fields: fields([["freshWaterCapacity", "Fresh Water Capacity"], ["grayWaterCapacity", "Gray Water Capacity"], ["wasteWaterCapacity", "Black / Waste Water Capacity"], ["fuelCapacity", "Fuel Capacity"], ["propaneTankCount", "Number of Propane Tanks"], ["propaneCapacity", "Propane Capacity"], ["lpgCapacity", "LPG Capacity"]]) },
  { title: "Sleeping & Layout", fields: fields([["sleepingCapacity", "Sleeping Capacity"], ["bedCount", "Number of Beds"], ["bedTypes", "Bed Types"], ["kingBed", "King Bed"], ["queenBed", "Queen Bed"], ["bunkhouse", "Bunkhouse"], ["loft", "Loft"], ["sofaSleeper", "Sofa Sleeper"], ["dinetteSleeper", "Dinette Sleeper"]]) },
  { title: "Slides, Axles & Tires", fields: fields([["slideOutCount", "Number of Slide-Outs"], ["slideType", "Slide Type"], ["slideDescription", "Slide Description", true], ["axleCount", "Number of Axles"], ["axleRating", "Axle Rating"], ["tireSize", "Tire Size"], ["wheelSize", "Wheel Size"]]) },
  { title: "Appliances", fields: fields([["refrigeratorSize", "Refrigerator Size"], ["refrigeratorType", "Refrigerator Type"], ["stoveCooktop", "Stove / Cooktop"], ["oven", "Oven"], ["microwave", "Microwave"], ["dishwasher", "Dishwasher"], ["washerDryer", "Washer/Dryer"], ["washerDryerPrep", "Washer/Dryer Prep"]]) },
  { title: "HVAC & Electrical", fields: fields([["acUnitCount", "Number of AC Units"], ["acBtu", "AC BTU"], ["furnaceBtu", "Furnace BTU"], ["heatPump", "Heat Pump"], ["fireplace", "Fireplace"], ["shorePower", "Shore Power"], ["generator", "Generator"], ["generatorPrep", "Generator Prep"], ["solar", "Solar"], ["solarPrep", "Solar Prep"], ["inverter", "Inverter"], ["batterySystem", "Battery System"]]) },
  { title: "Exterior & Interior Features", fields: fields([["constructionType", "Construction Type"], ["frame", "Frame"], ["roof", "Roof"], ["exteriorMaterial", "Exterior Material"], ["awning", "Awning"], ["exteriorKitchen", "Exterior Kitchen"], ["exteriorStorage", "Exterior Storage"], ["outdoorShower", "Outdoor Shower"], ["ladder", "Ladder"], ["levelingSystem", "Leveling System"], ["backupCameraPrep", "Backup Camera Prep"], ["sideCameraPrep", "Side Camera Prep"], ["flooring", "Flooring"], ["cabinetry", "Cabinetry"], ["countertops", "Countertops"], ["entertainmentSystem", "Entertainment System"], ["tv", "TV"], ["theaterSeating", "Theater Seating"], ["recliners", "Recliners"], ["dinetteType", "Dinette Type"]]) },
  { title: "Bathroom & Kitchen", fields: fields([["bathroomCount", "Number of Bathrooms"], ["halfBath", "Half Bath"], ["showerType", "Shower Type"], ["residentialShower", "Residential Shower"], ["toiletType", "Toilet Type"], ["kitchenIsland", "Kitchen Island"], ["residentialRefrigerator", "Residential Refrigerator"], ["pantry", "Pantry"], ["sinkType", "Sink Type"]]) },
  { title: "Garage / Toy Hauler", fields: fields([["garageLength", "Garage Length"], ["garageWidth", "Garage Width"], ["rampDoor", "Ramp Door"], ["fuelStation", "Fuel Station"], ["tieDowns", "Tie Downs"]]) },
  { title: "Motorized RV Specifications", fields: fields([["engine", "Engine"], ["horsepower", "Horsepower"], ["torque", "Torque"], ["transmission", "Transmission"], ["chassis", "Chassis"], ["fuelType", "Fuel Type"]]) },
  { title: "Pricing & Warranty", fields: fields([["msrp", "MSRP"], ["startingPrice", "Starting Price"], ["advertisedPrice", "Advertised Price"], ["structuralWarranty", "Structural Warranty"], ["limitedWarranty", "Limited Warranty"], ["applianceWarranty", "Appliance Warranty"], ["chassisWarranty", "Chassis Warranty"], ["otherWarrantyInformation", "Other Warranty Information", true]]) },
  { title: "Features & Options", fields: fields([["standardFeatures", "Standard Features", true], ["optionalFeatures", "Optional Features", true], ["packages", "Packages", true], ["highlights", "Highlights", true]]) },
];

const aliases: Record<string, string> = {
  "shipping weight": "shippingWeight", "carrying capacity": "carryingCapacity", hitch: "hitchWeight", "hitch weight": "hitchWeight", length: "overallLength", "overall length": "overallLength", height: "exteriorHeight", "exterior height": "exteriorHeight", "tire size": "tireSize", "fresh water": "freshWaterCapacity", "fresh water capacity": "freshWaterCapacity", "gray water": "grayWaterCapacity", "gray water capacity": "grayWaterCapacity", "waste water": "wasteWaterCapacity", "black water": "wasteWaterCapacity", "sleeping capacity": "sleepingCapacity", "number of propane tanks": "propaneTankCount", propane: "propaneCapacity", lpg: "lpgCapacity", "refrigerator size": "refrigeratorSize", "product line": "productLine", "rv type": "rvType"
};

export function canonicalRvSpecificationKey(key: string) {
  const normalized = key.trim().replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/\s+/g, " ");
  return aliases[normalized] || key.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase());
}

export function normalizeRvSpecifications(specifications: Record<string, string>) {
  return Object.fromEntries(Object.entries(specifications).map(([key, value]) => [canonicalRvSpecificationKey(key), value]));
}
