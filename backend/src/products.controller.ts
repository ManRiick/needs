import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { CreateProductDto } from "./products.dto";
import { ProductsService } from "./products.service";

@Controller("products")
@UseGuards(AuthGuard)
export class ProductsController {
  // Initialise contrôleur
  constructor(private readonly productsService: ProductsService) {}

  // Recherche produits
  @Get()
  search(@Query("search") search?: string) {
    return this.productsService.search(search);
  }

  // Liste catégories
  @Get("categories")
  categories() {
    return this.productsService.categories();
  }

  // Liste unités
  @Get("units")
  units() {
    return this.productsService.units();
  }

  // Charge produit
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  // Crée produit
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProductDto) {
    return this.productsService.create(request.user.sub, dto);
  }
}
