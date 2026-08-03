import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

// --- Brand Colors ---
const Color kEmeraldPrimary = Color(0xFF064E3B);
const Color kGoldSecondary = Color(0xFFD4AF37);
const Color kStoneBackground = Color(0xFFF9F8F6);

// --- Models ---
class Category {
  final String id;
  final String name;

  const Category({required this.id, required this.name});
}

class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final double? compareAtPrice;
  final int stock;
  final String storeName;
  final double rating;
  final int reviewsCount;

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.compareAtPrice,
    required this.stock,
    required this.storeName,
    required this.rating,
    required this.reviewsCount,
  });
}

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, required this.quantity});
}

// --- Fallback Mock Data ---
const List<Category> kMockCategories = [
  Category(id: 'cat-1', name: 'Electronics'),
  Category(id: 'cat-2', name: 'Luxury Apparel'),
  Category(id: 'cat-3', name: 'Home Accessories'),
];

const List<Product> kMockProducts = [
  Product(
    id: 'p1',
    name: 'Veridia Eco-Phone 12',
    description: 'High-end smartphone built sustainably with recycled emerald aluminum alloy and gold-leaf microprocessors.',
    price: 899.99,
    compareAtPrice: 999.99,
    stock: 8,
    storeName: 'Veridia Official Outlet',
    rating: 4.9,
    reviewsCount: 12,
  ),
  Product(
    id: 'p2',
    name: 'Luxury Emerald Watch',
    description: 'Bespoke automatic timepiece featuring a stunning deep emerald dial and 18k gold bezels.',
    price: 1450.00,
    compareAtPrice: 1650.00,
    stock: 3,
    storeName: 'Aureum Watch Co.',
    rating: 5.0,
    reviewsCount: 8,
  ),
  Product(
    id: 'p3',
    name: 'Gold Trim Organic Hoodie',
    description: 'Heavyweight organic cotton knitwear finished with luxurious gold metallic embroidery.',
    price: 120.00,
    stock: 15,
    storeName: 'Veridia Official Outlet',
    rating: 4.6,
    reviewsCount: 24,
  ),
  Product(
    id: 'p4',
    name: 'Smart Ambient Light Beam',
    description: 'Sync your study room with warm gold tones and deep forest green hues.',
    price: 180.00,
    compareAtPrice: 220.00,
    stock: 25,
    storeName: 'Apex Tech Goods',
    rating: 4.4,
    reviewsCount: 19,
  ),
];

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Veridia',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: kStoneBackground,
        colorScheme: ColorScheme.fromSeed(
          seedColor: kEmeraldPrimary,
          primary: kEmeraldPrimary,
          secondary: kGoldSecondary,
          surface: Colors.white,
        ),
        fontFamily: 'sans-serif',
      ),
      home: const MainNavigationPage(),
    );
  }
}

class MainNavigationPage extends StatefulWidget {
  const MainNavigationPage({super.key});

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _currentIndex = 0;
  final List<CartItem> _cart = [];

  // Add to cart helper
  void _addToCart(Product product) {
    final existingIndex = _cart.indexWhere((item) => item.product.id == product.id);
    setState(() {
      if (existingIndex >= 0) {
        if (_cart[existingIndex].quantity >= product.stock) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Only ${product.stock} units available in stock!')),
          );
          return;
        }
        _cart[existingIndex].quantity++;
      } else {
        _cart.add(CartItem(product: product, quantity: 1));
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Added ${product.name} to cart!')),
    );
  }

  // Update quantity helper
  void _updateCartQty(String productId, int delta) {
    final index = _cart.indexWhere((item) => item.product.id == productId);
    if (index >= 0) {
      setState(() {
        final nextQty = _cart[index].quantity + delta;
        if (nextQty > _cart[index].product.stock) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Limit reached: only ${_cart[index].product.stock} units in stock.')),
          );
          return;
        }
        _cart[index].quantity = nextQty;
        if (_cart[index].quantity <= 0) {
          _cart.removeAt(index);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      CatalogTab(onAddToCart: _addToCart),
      CartTab(
        cart: _cart,
        onUpdateQty: _updateCartQty,
        onCheckoutSuccess: () {
          setState(() {
            _cart.clear();
          });
        },
      ),
      const ProfileTab(),
    ];

    return Scaffold(
      body: SafeArea(child: pages[_currentIndex]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront, color: kEmeraldPrimary),
            label: 'Catalog',
          ),
          NavigationDestination(
            icon: Badge(
              label: Text('${_cart.fold<int>(0, (sum, item) => sum + item.quantity)}'),
              isLabelVisible: _cart.isNotEmpty,
              child: const Icon(Icons.shopping_bag_outlined),
            ),
            selectedIcon: Badge(
              label: Text('${_cart.fold<int>(0, (sum, item) => sum + item.quantity)}'),
              isLabelVisible: _cart.isNotEmpty,
              child: const Icon(Icons.shopping_bag, color: kEmeraldPrimary),
            ),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: kEmeraldPrimary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// --- Tab 1: Product Catalog Feed ---
class CatalogTab extends StatefulWidget {
  final Function(Product) onAddToCart;

  const CatalogTab({super.key, required this.onAddToCart});

  @override
  State<CatalogTab> createState() => _CatalogTabState();
}

class _CatalogTabState extends State<CatalogTab> {
  String _selectedCategoryId = '';
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    // Filtering
    final filteredList = kMockProducts.where((prod) {
      final matchesCategory = _selectedCategoryId.isEmpty || prod.id.contains(_selectedCategoryId);
      final matchesSearch = _searchQuery.isEmpty ||
          prod.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          prod.description.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Brand Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Text(
                    'Veridia',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: kEmeraldPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  Text(
                    ' • Store',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: kGoldSecondary,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () {},
              ),
            ],
          ),
          const SizedBox(height: 12.0),

          // Search Field
          TextField(
            onChanged: (val) {
              setState(() {
                _searchQuery = val;
              });
            },
            decoration: InputDecoration(
              hintText: 'Search organic & luxury goods...',
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16.0),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
          const SizedBox(height: 16.0),

          // Categories horizontal picker list
          SizedBox(
            height: 38.0,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedCategoryId = '';
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _selectedCategoryId.isEmpty ? kEmeraldPrimary : Colors.white,
                      borderRadius: BorderRadius.circular(20.0),
                    ),
                    child: Text(
                      'All Products',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _selectedCategoryId.isEmpty ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8.0),
                ...kMockCategories.map((cat) {
                  final isSel = _selectedCategoryId == cat.id;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedCategoryId = cat.id;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isSel ? kEmeraldPrimary : Colors.white,
                          borderRadius: BorderRadius.circular(20.0),
                        ),
                        child: Text(
                          cat.name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isSel ? Colors.white : Colors.black87,
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 20.0),

          // Grid View Product list
          Expanded(
            child: filteredList.isEmpty
                ? const Center(child: Text('No premium products match your filters.'))
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 16.0,
                      mainAxisSpacing: 16.0,
                      childAspectRatio: 0.72,
                    ),
                    itemCount: filteredList.length,
                    itemBuilder: (context, index) {
                      final prod = filteredList[index];
                      final isLowStock = prod.stock <= 5;

                      return Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24.0),
                          boxShadow: [
                            const BoxShadow(
                              color: Color(0x05000000),
                              blurRadius: 10,
                              offset: Offset(0, 4),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Mock image display placeholder
                            Expanded(
                              child: Container(
                                color: const Color(0xFFF5F5F4),
                                alignment: Alignment.center,
                                child: Stack(
                                  children: [
                                    Center(
                                      child: Text(
                                        prod.name.substring(0, 2).toUpperCase(),
                                        style: const TextStyle(
                                          fontSize: 24,
                                          fontWeight: FontWeight.w900,
                                          color: kEmeraldPrimary,
                                        ),
                                      ),
                                    ),
                                    if (isLowStock)
                                      Positioned(
                                        bottom: 8.0,
                                        left: 8.0,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 3.0),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFDC2626),
                                            borderRadius: BorderRadius.circular(4.0),
                                          ),
                                          child: Text(
                                            '${prod.stock} left',
                                            style: const TextStyle(
                                              fontSize: 8,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),

                            // Details
                            Padding(
                              padding: const EdgeInsets.all(12.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    prod.storeName,
                                    style: const TextStyle(fontSize: 8.0, color: Colors.grey, fontWeight: FontWeight.bold),
                                  ),
                                  const SizedBox(height: 2.0),
                                  Text(
                                    prod.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.0),
                                  ),
                                  const SizedBox(height: 4.0),
                                  Row(
                                    children: [
                                      const Icon(Icons.star, size: 10, color: kGoldSecondary),
                                      const SizedBox(width: 2.0),
                                      Text(
                                        '${prod.rating}',
                                        style: const TextStyle(fontSize: 10.0, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8.0),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '\$${prod.price.toStringAsFixed(2)}',
                                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15.0, color: kEmeraldPrimary),
                                      ),
                                      GestureDetector(
                                        onTap: () => widget.onAddToCart(prod),
                                        child: Container(
                                          padding: const EdgeInsets.all(6.0),
                                          decoration: BoxDecoration(
                                            color: kEmeraldPrimary,
                                            borderRadius: BorderRadius.circular(8.0),
                                          ),
                                          child: const Icon(Icons.add, size: 14.0, color: Colors.white),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

// --- Tab 2: Shopping Cart view ---
class CartTab extends StatelessWidget {
  final List<CartItem> cart;
  final Function(String, int) onUpdateQty;
  final VoidCallback onCheckoutSuccess;

  const CartTab({
    super.key,
    required this.cart,
    required this.onUpdateQty,
    required this.onCheckoutSuccess,
  });

  @override
  Widget build(BuildContext context) {
    final subtotal = cart.fold<double>(0, (sum, item) => sum + item.product.price * item.quantity);
    final savings = cart.fold<double>(0, (sum, item) {
      if (item.product.compareAtPrice != null) {
        return sum + (item.product.compareAtPrice! - item.product.price) * item.quantity;
      }
      return sum;
    });

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Shopping Cart',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: kEmeraldPrimary),
          ),
          const SizedBox(height: 16.0),

          // Items scroll list
          Expanded(
            child: cart.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_bag_outlined, size: 48, color: Colors.grey),
                        SizedBox(height: 8.0),
                        Text('Your mobile cart is empty.', style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: cart.length,
                    itemBuilder: (context, index) {
                      final item = cart[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12.0),
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16.0),
                        ),
                        child: Row(
                          children: [
                            Container(
                              height: 50,
                              width: 50,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF5F5F4),
                                borderRadius: BorderRadius.circular(12.0),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                item.product.name.substring(0, 2).toUpperCase(),
                                style: const TextStyle(fontWeight: FontWeight.w900, color: kEmeraldPrimary),
                              ),
                            ),
                            const SizedBox(width: 12.0),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.0)),
                                  const SizedBox(height: 2.0),
                                  Text('\$${item.product.price.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12.0, color: kEmeraldPrimary, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove, size: 16.0),
                                  onPressed: () => onUpdateQty(item.product.id, -1),
                                ),
                                Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w900)),
                                IconButton(
                                  icon: const Icon(Icons.add, size: 16.0),
                                  onPressed: () => onUpdateQty(item.product.id, 1),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Total & Checkout
          if (cart.isNotEmpty) ...[
            const Divider(),
            if (savings > 0)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Savings', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                    Text('-\$${savings.toStringAsFixed(2)}', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16.0)),
                Text('\$${subtotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18.0, color: kEmeraldPrimary)),
              ],
            ),
            const SizedBox(height: 16.0),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: kEmeraldPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
                ),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (context) => CheckoutSheet(onSuccess: onCheckoutSuccess),
                  );
                },
                child: const Text('Checkout Mobile Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Checkout Bottom Sheet ---
class CheckoutSheet extends StatefulWidget {
  final VoidCallback onSuccess;

  const CheckoutSheet({super.key, required this.onSuccess});

  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  final _streetController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        top: 24.0,
        left: 24.0,
        right: 24.0,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Delivery Address', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16.0),
            TextField(
              controller: _streetController,
              decoration: const InputDecoration(labelText: 'Street Address', hintText: '123 Sapphire St'),
            ),
            const SizedBox(height: 12.0),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cityController,
                    decoration: const InputDecoration(labelText: 'City', hintText: 'Lekki'),
                  ),
                ),
                const SizedBox(width: 12.0),
                Expanded(
                  child: TextField(
                    controller: _stateController,
                    decoration: const InputDecoration(labelText: 'State', hintText: 'Lagos'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24.0),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: kEmeraldPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
                ),
                onPressed: () {
                  if (_streetController.text.isEmpty || _cityController.text.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please fill out shipping details!')),
                    );
                    return;
                  }
                  Navigator.pop(context);
                  widget.onSuccess();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Mobile Order checked out & payment mock authorized!')),
                  );
                },
                child: const Text('Confirm Secure Purchase', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 24.0),
          ],
        ),
      ),
    );
  }
}

// --- Tab 3: User Profile view ---
class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'User Profile',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: kEmeraldPrimary),
          ),
          const SizedBox(height: 24.0),

          // User info card
          Container(
            padding: const EdgeInsets.all(16.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20.0),
            ),
            child: Row(
              children: [
                const CircleAvatar(
                  radius: 30,
                  backgroundColor: kEmeraldPrimary,
                  child: Icon(Icons.person, color: Colors.white, size: 30),
                ),
                const SizedBox(width: 16.0),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Alice Alpha', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2.0),
                    const Text('customer.alice@veridia.com', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 4.0),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(4.0),
                      ),
                      child: const Text(
                        'Verified Customer',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
