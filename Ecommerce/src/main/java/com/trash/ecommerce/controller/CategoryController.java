package com.trash.ecommerce.controller;

import com.trash.ecommerce.entity.Category;
import com.trash.ecommerce.repository.CategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    @Autowired
    private CategoryRepository categoryRepository;

    @GetMapping({"", "/"})
    public ResponseEntity<List<Category>> getAllRootCategories() {
        List<Category> categories = categoryRepository.findByParentIsNullOrderBySortOrderAsc();
        return ResponseEntity.ok(categories);
    }

    @GetMapping("/{id}/children")
    public ResponseEntity<List<Category>> getChildCategories(@PathVariable Long id) {
        List<Category> children = categoryRepository.findByParentIdOrderBySortOrderAsc(id);
        return ResponseEntity.ok(children);
    }

    @GetMapping("/all")
    public ResponseEntity<List<Category>> getAllCategories() {
        List<Category> categories = categoryRepository.findAll();
        return ResponseEntity.ok(categories);
    }
}
