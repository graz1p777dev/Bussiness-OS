from django.http import JsonResponse
from django.urls import path
from core import auth, views, pos_views as pos

urlpatterns = [
    path("api/os/v1/health", lambda request: JsonResponse({"status": "ok", "mode": "local"})),
    path("api/os/v1/auth/csrf", auth.csrf),
    path("api/os/v1/auth/login", auth.sign_in),
    path("api/os/v1/auth/logout", views.LogoutView.as_view()),
    path("api/os/v1/me", views.MeView.as_view()),
    path("api/os/v1/customers", views.CustomersView.as_view()),
    path("api/os/v1/pos/customers", views.PosCustomersView.as_view()),
    path("api/os/v1/customers/<uuid:id>", views.CustomerView.as_view()),
    path("api/os/v1/pipelines", views.PipelinesView.as_view()),
    path("api/os/v1/deals", views.DealsView.as_view()),
    path("api/os/v1/deals/<uuid:id>", views.DealView.as_view()),
    path("api/os/v1/deals/<uuid:id>/move", views.MoveDealView.as_view()),
    path("api/os/v1/deals/<uuid:id>/events", views.DealEventsView.as_view()),
]

urlpatterns += [
    path("api/os/v1/products", pos.CatalogView.as_view()),
    path("api/os/v1/products/<uuid:id>", pos.CatalogView.as_view()),
    path("api/os/v1/pos/products", pos.PosProductsView.as_view()),
    path("api/os/v1/warehouses", pos.WarehousesView.as_view()),
    path("api/os/v1/warehouses/<uuid:id>", pos.WarehousesView.as_view()),
    path("api/os/v1/registers", pos.RegistersView.as_view()),
    path("api/os/v1/registers/<uuid:id>", pos.RegistersView.as_view()),
    path("api/os/v1/stocks", pos.StocksView.as_view()),
    path("api/os/v1/stock-movements", pos.StockMovementsView.as_view()),
    path("api/os/v1/shifts", pos.ShiftsView.as_view()),
    path("api/os/v1/shifts/current", pos.CurrentShiftView.as_view()),
    path("api/os/v1/shifts/<uuid:id>/close", pos.CloseShiftView.as_view()),
    path("api/os/v1/sales", pos.SalesView.as_view()),
    path("api/os/v1/sales/complete", pos.CompleteSaleView.as_view()),
    path("api/os/v1/sales/<uuid:id>", pos.SalesView.as_view()),
    path("api/os/v1/sales/<uuid:id>/refunds", pos.RefundSaleView.as_view()),
    path("api/os/v1/coupons", pos.CouponsView.as_view()),
    path("api/os/v1/coupons/<uuid:id>", pos.CouponsView.as_view()),
    path("api/os/v1/pos/customers/<uuid:id>/coupons", pos.PosCouponsView.as_view()),
]
